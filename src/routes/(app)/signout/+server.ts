import { json, redirect, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ locals }) => {
    if (!locals.pocketBase.authStore.isValid) {
        return json({});
    }

    locals.pocketBase.authStore.clear();

    throw redirect(303, "/signup");
};
