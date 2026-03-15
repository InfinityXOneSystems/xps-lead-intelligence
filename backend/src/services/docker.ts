/**
 * Docker MCP Gateway
 * Connects the agent to the local Docker Engine via the Unix socket.
 * Exposes container lifecycle, exec, logs, and sandbox creation.
 */

import Docker from 'dockerode';

let _docker: Docker | null = null;

export function getDocker(): Docker {
  if (!_docker) {
    const socketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
    const host = process.env.DOCKER_HOST;
    const port = process.env.DOCKER_PORT ? parseInt(process.env.DOCKER_PORT, 10) : undefined;

    if (host && port) {
      _docker = new Docker({ host, port });
    } else {
      _docker = new Docker({ socketPath });
    }
  }
  return _docker;
}

export function isDockerAvailable(): boolean {
  return !!(process.env.DOCKER_SOCKET_PATH || process.env.DOCKER_HOST || true);
}

// ─── Container listing ────────────────────────────────────────────────────────

export interface ContainerSummary {
  id: string;
  names: string[];
  image: string;
  status: string;
  state: string;
  ports: { host?: number; container?: number; type?: string }[];
  created: number;
  labels: Record<string, string>;
}

export async function listContainers(all = false): Promise<ContainerSummary[]> {
  const docker = getDocker();
  const containers = await docker.listContainers({ all });
  return containers.map((c) => ({
    id: c.Id.slice(0, 12),
    names: c.Names.map((n) => n.replace(/^\//, '')),
    image: c.Image,
    status: c.Status,
    state: c.State,
    ports: (c.Ports || []).map((p) => ({ host: p.PublicPort, container: p.PrivatePort, type: p.Type })),
    created: c.Created,
    labels: c.Labels || {},
  }));
}

// ─── Execute command in a container ──────────────────────────────────────────

export async function execInContainer(
  containerId: string,
  cmd: string[],
  workDir?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const docker = getDocker();
  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: workDir,
  });

  return new Promise((resolve, reject) => {
    exec.start({ hijack: true, stdin: false }, (err, stream) => {
      if (err) return reject(err);
      if (!stream) return resolve({ stdout: '', stderr: '', exitCode: -1 });

      let stdout = '';
      let stderr = '';

      // Docker multiplexes stdout/stderr on a single stream with 8-byte headers
      const demux = (chunk: Buffer) => {
        let offset = 0;
        while (offset < chunk.length) {
          if (chunk.length < offset + 8) break;
          const streamType = chunk[offset];
          const size = chunk.readUInt32BE(offset + 4);
          const payload = chunk.slice(offset + 8, offset + 8 + size).toString('utf8');
          if (streamType === 1) stdout += payload;
          else if (streamType === 2) stderr += payload;
          offset += 8 + size;
        }
      };

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', async () => {
        demux(Buffer.concat(chunks));
        try {
          const inspect = await exec.inspect();
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: inspect.ExitCode ?? 0 });
        } catch {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 });
        }
      });
      stream.on('error', reject);
    });
  });
}

// ─── Get container logs ───────────────────────────────────────────────────────

export async function getContainerLogs(
  containerId: string,
  tail = 100,
): Promise<string> {
  const docker = getDocker();
  const container = docker.getContainer(containerId);
  const stream = await container.logs({ stdout: true, stderr: true, tail, follow: false });
  // logs come as a Buffer with Docker multiplexing headers
  const raw = stream.toString('utf8');
  // Strip the 8-byte headers (simple approach: remove non-printable chars)
  return raw.replace(/[\x00-\x08\x0e-\x1f]/g, '').trim();
}

// ─── Pull an image ────────────────────────────────────────────────────────────

export async function pullImage(image: string): Promise<void> {
  const docker = getDocker();
  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err2: Error | null) => {
        if (err2) reject(err2);
        else resolve();
      });
    });
  });
}

// ─── Sandbox containers ───────────────────────────────────────────────────────

export interface SandboxConfig {
  name: string;
  image: string;
  hostPort: number;
  containerPort: number;
  env?: Record<string, string>;
  cmd?: string[];
  workDir?: string;
  labels?: Record<string, string>;
}

export async function createSandbox(config: SandboxConfig): Promise<string> {
  const docker = getDocker();

  const container = await docker.createContainer({
    name: config.name,
    Image: config.image,
    Cmd: config.cmd,
    WorkingDir: config.workDir || '/app',
    Env: config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : [],
    Labels: { 'xps.sandbox': 'true', ...config.labels },
    ExposedPorts: { [`${config.containerPort}/tcp`]: {} },
    HostConfig: {
      PortBindings: {
        [`${config.containerPort}/tcp`]: [{ HostPort: String(config.hostPort) }],
      },
      AutoRemove: false,
    },
  });

  await container.start();
  return container.id.slice(0, 12);
}

export async function stopAndRemoveSandbox(containerId: string): Promise<void> {
  const docker = getDocker();
  const container = docker.getContainer(containerId);
  try { await container.stop({ t: 5 }); } catch { /* already stopped */ }
  try { await container.remove(); } catch { /* already removed */ }
}

export async function listSandboxes(): Promise<ContainerSummary[]> {
  const all = await listContainers(true);
  return all.filter((c) => c.labels['xps.sandbox'] === 'true');
}

// ─── Write a file into a container ────────────────────────────────────────────

export async function writeFileToContainer(
  containerId: string,
  filePath: string,
  content: string,
): Promise<void> {
  const dirPath = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : '/app';
  // Write via shell printf (works for text files)
  const escaped = content.replace(/'/g, "'\\''");
  await execInContainer(containerId, [
    'sh', '-c',
    `mkdir -p ${dirPath} && printf '%s' '${escaped}' > ${filePath.startsWith('/') ? filePath : `/app/${filePath}`}`,
  ]);
}

// ─── Read a file from a container ────────────────────────────────────────────

export async function readFileFromContainer(
  containerId: string,
  filePath: string,
): Promise<string> {
  const result = await execInContainer(containerId, ['cat', filePath]);
  if (result.exitCode !== 0) throw new Error(result.stderr || 'File not found');
  return result.stdout;
}
