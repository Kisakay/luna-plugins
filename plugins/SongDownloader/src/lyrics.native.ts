import { mkdir, writeFile } from "fs/promises";
import { join, parse } from "path";

/** Exécuté côté natif (proxy IPC) : écrit un fichier texte à côté de la track. */
export const saveTextFile = async (filePath: string | string[], text: string): Promise<void> => {
	if (Array.isArray(filePath)) filePath = join(...filePath);
	const parsed = parse(filePath);
	await mkdir(parsed.dir, { recursive: true });
	await writeFile(filePath, text, "utf8");
};
