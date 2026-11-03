import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPOSITORY_ROOT } from "../plugins/installed-plugins.js";

/**
 * The ready-made settings for Railway, Render, Fly.io and a DigitalOcean droplet. Each must
 * build the Dockerfile, check /ready, keep /data, and reach Lintel on the port it uses.
 * The image itself is built and started by deploy/smoke-test.mjs.
 */
const read = (file: string) => readFileSync(join(REPOSITORY_ROOT, file), "utf8");

describe("deploy recipes", () => {
  it("builds the image every recipe uses", () => {
    const dockerfile = read("Dockerfile");
    expect(dockerfile).toContain("EXPOSE 4000");
    // Every workspace package the API and admin are built from is installed before the build.
    for (const folder of [
      "core",
      "admin",
      "builder",
      "builder-model",
      "motion",
      "site-components",
    ]) {
      expect(dockerfile).toContain(`COPY packages/${folder}/package.json packages/${folder}/`);
    }
  });

  it("gives Render a web service with a disk and its own Postgres", () => {
    const blueprint = parse(read("render.yaml")) as {
      services: Array<Record<string, unknown>>;
      databases: Array<{ name: string }>;
    };
    const [web] = blueprint.services;
    expect(web).toMatchObject({
      type: "web",
      runtime: "docker",
      healthCheckPath: "/ready",
      disk: { mountPath: "/data" },
    });
    expect(web?.envVars).toContainEqual({
      key: "DATABASE_URL",
      fromDatabase: { name: blueprint.databases[0]?.name, property: "connectionString" },
    });
  });

  it("gives Railway the Dockerfile and the readiness check", () => {
    const railway = JSON.parse(read("railway.json")) as {
      build: { builder: string; dockerfilePath: string };
      deploy: { healthcheckPath: string };
    };
    expect(railway.build.builder).toBe("DOCKERFILE");
    expect(existsSync(join(REPOSITORY_ROOT, railway.build.dockerfilePath))).toBe(true);
    expect(railway.deploy.healthcheckPath).toBe("/ready");
  });

  it("gives Fly.io one machine that stays up, on Lintel's port, with a volume", () => {
    const fly = read("fly.toml");
    expect(fly).toMatch(/internal_port = 4000/);
    expect(fly).toMatch(/auto_stop_machines = "off"/);
    expect(fly).toMatch(/path = "\/ready"/);
    expect(fly).toMatch(/destination = "\/data"/);
  });

  it("installs a DigitalOcean droplet with the VPS installer, without questions", () => {
    const script = read("deploy/digitalocean/user-data.sh");
    expect(script).toContain("deploy/install.sh");
    expect(script).toContain("--yes");
    expect(
      spawnSync("bash", ["-n", join(REPOSITORY_ROOT, "deploy/digitalocean/user-data.sh")]).status,
    ).toBe(0);
  });
});
