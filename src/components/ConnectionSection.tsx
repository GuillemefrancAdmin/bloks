// Which Bloks server this window is talking to, said plainly: this
// computer's own, another computer's through Bloks Cloud, or a developer's
// harness behind Vite. Read-only; moving elsewhere lives in Phone and
// devices.
import { useCallback, useEffect, useState } from "react";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.mjs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SettingRow, SettingsGroup } from "./SettingsLayout";

type Health = {
  app: string;
  pid: number;
  static: boolean;
  version?: string;
  host?: string;
  port?: number;
  bind?: string;
  dataDir?: string;
  uptime?: number;
};

type Remote = { mode: "local" } | { mode: "remote"; host: string; connected: boolean; revoked?: boolean };

function since(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} days`;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="break-all rounded bg-muted px-1 font-mono text-[12px] text-foreground">{children}</code>;
}

export function ConnectionSection() {
  const bridge = typeof window !== "undefined" ? window.bloks : undefined;
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [remote, setRemote] = useState<Remote | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setHealth(await response.json());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    if (!bridge?.remoteStatus) return;
    void bridge.remoteStatus().then(setRemote);
    return bridge.onRemoteState?.((state) => setRemote({ mode: "remote", ...state }));
  }, [bridge]);

  const origin = window.location.origin;
  const isRemote = remote?.mode === "remote";
  // The packaged app and a plain harness serve the UI themselves; anything
  // else answering /api for a page it did not serve is a dev proxy.
  const viaProxy = !isRemote && health !== null && !health.static;
  const serverAddress = health?.port ? `http://127.0.0.1:${health.port}` : null;

  const where = isRemote
    ? `${remote.host}'s computer, through Bloks Cloud`
    : viaProxy
      ? "A development server on this computer"
      : "This computer";

  const status = failed
    ? { dot: "bg-destructive", text: "Not answering. Is the server running?" }
    : isRemote && remote.revoked
      ? { dot: "bg-warning", text: "That computer no longer recognises this app." }
      : isRemote && !remote.connected
        ? { dot: "bg-warning", text: "That computer is not reachable right now." }
        : health
          ? { dot: "bg-success", text: "Connected." }
          : { dot: "bg-muted-foreground", text: "Checking…" };

  return (
    <>
      <SettingsGroup title="Connected to">
        <SettingRow
          label={where}
          description={
            <span className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2 shrink-0 rounded-full", status.dot)} aria-hidden />
              {status.text}
            </span>
          }
          control={
            <Button size="sm" variant="secondary" disabled={checking} onClick={() => void check()}>
              <RefreshCw size={14} className={cn(checking && "animate-spin")} /> Check again
            </Button>
          }
        />
        <SettingRow
          label="App address"
          info="Where this window loaded Bloks from. Every request the app makes goes to this address."
          description={<Mono>{origin}</Mono>}
        />
        {viaProxy && serverAddress && (
          <SettingRow
            label="Forwarded to"
            info="In development the page comes from Vite, which passes every /api request on to the Bloks server. Set BLOKS_PORT before starting Vite to use a different one."
            description={<Mono>{serverAddress}</Mono>}
          />
        )}
        {isRemote && (
          <SettingRow
            label="Remote computer"
            description={
              <>
                <Mono>{remote.host}</Mono>, reached through Bloks Cloud. To go back to this computer's own Bloks, use
                Phone and devices.
              </>
            }
          />
        )}
      </SettingsGroup>

      {health && (
        <SettingsGroup title="Server">
          <SettingRow label="Machine" description={<Mono>{health.host ?? "unknown"}</Mono>} />
          {serverAddress && (
            <SettingRow
              label="Listening on"
              description={
                <>
                  <Mono>
                    {health.bind ?? "127.0.0.1"}:{health.port}
                  </Mono>{" "}
                  {health.bind && health.bind !== "127.0.0.1"
                    ? "Reachable from other devices on the network."
                    : "This computer only."}
                </>
              }
            />
          )}
          {health.version && <SettingRow label="Version" description={<Mono>Bloks {health.version}</Mono>} />}
          <SettingRow
            label="Process"
            description={
              <>
                <Mono>pid {health.pid}</Mono>
                {typeof health.uptime === "number" && <> · running for {since(health.uptime)}</>}
              </>
            }
          />
          {health.dataDir && (
            <SettingRow
              label="Data folder"
              info="Where this server keeps agents, conversations and settings."
              description={<Mono>{health.dataDir}</Mono>}
            />
          )}
        </SettingsGroup>
      )}
    </>
  );
}
