import { spawnSync } from "node:child_process";

function tryCommand(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  return result.status === 0;
}

const args = process.argv.slice(2);

if (tryCommand("docker", ["compose", ...args])) {
  process.exit(0);
}

if (tryCommand("docker-compose", args)) {
  process.exit(0);
}

console.error(`
No se pudo ejecutar Docker Compose.

En WSL/Ubuntu instala el plugin:
  sudo apt update && sudo apt install -y docker-compose-v2

O instala el binario clásico:
  sudo apt install -y docker-compose

Alternativa sin Docker (PostgreSQL en WSL):
  sudo apt install -y postgresql postgresql-contrib
  sudo service postgresql start
  sudo -u postgres psql -c "CREATE DATABASE summari;"
  sudo -u postgres psql -d summari -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
  # En .env usa:
  # DATABASE_URL=postgresql://postgres@localhost:5432/summari
`);

process.exit(1);
