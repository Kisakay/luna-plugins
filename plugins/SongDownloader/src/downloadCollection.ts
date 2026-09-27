import type { MediaCollection } from "@luna/lib";

import { enqueueCollection, type CtxButton } from "./downloadQueue";

/**
 * Point d'entrée historique : met désormais en file d'attente au lieu
 * d'interrompre le download en cours. Annulation via l'island / la bannière.
 */
export async function downloadMediaCollection(mediaCollection: MediaCollection, uiButton?: CtxButton): Promise<void> {
	await enqueueCollection(mediaCollection, uiButton, "collection");
}
