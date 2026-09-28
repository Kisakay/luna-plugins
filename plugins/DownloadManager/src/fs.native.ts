import { access, mkdir, writeFile } from "fs/promises";
import { join, parse } from "path";

/**
 * Pont fs exécuté côté natif (proxy IPC).
 * Voir downloadHistory pour la 1re couche de skip (ids en db).
 */

const toPath = (filePath: string | string[]): string => (Array.isArray(filePath) ? join(...filePath) : filePath);

/** true si le fichier existe déjà sur disque (double sécurité avant download). */
export const fileExists = async (filePath: string | string[]): Promise<boolean> => {
	try {
		await access(toPath(filePath));
		return true;
	} catch {
		return false;
	}
};

/** Écrit un fichier texte (ex: lyrics) à côté de la track. */
export const saveTextFile = async (filePath: string | string[], text: string): Promise<void> => {
	const resolved = toPath(filePath);
	const parsed = parse(resolved);
	await mkdir(parsed.dir, { recursive: true });
	await writeFile(resolved, text, "utf8");
};
