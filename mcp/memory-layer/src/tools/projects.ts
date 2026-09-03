import { writeNote } from "./notes.js";
import { PROJECTS_DIR } from "../config.js";

export async function createProject(
  vaultPath: string,
  name: string
): Promise<string> {
  const projectPath = `${PROJECTS_DIR}/${name}`;

  const readme = ``;

  await writeNote(vaultPath, `${projectPath}/README.md`, readme);
  await writeNote(vaultPath, `${projectPath}/notes/.gitkeep`, "");
  await writeNote(vaultPath, `${projectPath}/issues/active/.gitkeep`, "");
  await writeNote(vaultPath, `${projectPath}/issues/done/.gitkeep`, "");

  return `Created project at ${projectPath}/ with README.md, notes/, issues/active/, and issues/done/. Populate README.md with the project's existing README content.`;
}
