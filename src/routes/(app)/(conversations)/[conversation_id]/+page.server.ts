import { validateUser, type Conversation, type Message } from '$lib/types.js';
import { fail, redirect } from '@sveltejs/kit';
import type { RecordModel } from 'pocketbase';
import { v4 as uuid } from 'uuid';

export const actions = {
    sendMessage: async ({locals, request, params}) => {
        const authModel = locals.pocketBase.authStore.model;

        if (!(authModel || validateUser(authModel))) {
            throw redirect(303, '/login');
        }

        const formData = await request.formData();

        const messageContent = formData.get("message");

        try {
            if (typeof messageContent !== 'string') {
                throw new Error('Invalid message');
            }

            if (messageContent.length < 1) {
                throw new Error('Message cannot be empty');
            }

            const conversationCollection = locals.pocketBase.collection('conversations');

            let conversation: (RecordModel & Conversation) | undefined = await conversationCollection.getOne(params.conversation_id);

            if (!conversation) {
                throw new Error('Conversation not found');
            }

            const message: Message = {
                content: messageContent,
                contentType: 'message',
                user_id: authModel.id,
                created: new Date().toISOString(),
                id: uuid(),
            }

            if (conversation.messages.length >= 50) {
                conversation.messages = [
                    message,
                    ...conversation.messages.slice(0, 50)
                ]
            } else {
                conversation.messages = [
                    message,
                    ...conversation.messages
                ]
            }

            await locals.pocketBaseAdmin.collection('conversations').update(conversation.id, {
                messages: conversation.messages
            });
        } catch (error) {
            console.log(error);

            if (error instanceof Error) {
                return {
                    error: error.message
                }
            }

            return {
                error: "Unknown error occurred while sending message. Please try again later."
            }
        }

        throw redirect(303, `/${params.conversation_id}`);
    },
    sendImage: async ({locals, request, params}) => {
        const authModel = locals.pocketBase.authStore.model;

        if (!authModel || !validateUser(authModel)) {
            throw redirect(303, "/signup");
        }

        const formData = await request.formData();

        const photo = formData.get("photo");

        try {
            if (!(photo instanceof File)) {
                throw new Error(`Invalid message`);
            }

            if (photo.size === 0) {
                throw new Error(`Invalid message`);
            }

            const conversationsCollection = locals.pocketBase.collection("conversations");

            let conversation: (RecordModel & Conversation) | undefined = await conversationsCollection.getOne(params.conversation_id);

            if (!conversation) {
                throw new Error(`Conversation not found`);
            }

            const result: Conversation & RecordModel = await locals.pocketBaseAdmin
                .collection("conversations")
                .update(conversation.id, {
                message_photos: photo,
            });

            if (!result.message_photos) {
                throw new Error(`Error occured when uploading image`);
            }

            const message: Message = {
                content: result.message_photos[result.message_photos.length - 1],
                contentType: "image",
                user_id: authModel.id,
                created: new Date().toISOString(),
                id: uuid(),
            };

            if (conversation.messages.length >= 50) {
                conversation.messages = [
                    message,
                    ...conversation.messages.slice(0, 50),
                ];
            } else {
                conversation.messages = [message, ...conversation.messages];
            }

            await locals.pocketBaseAdmin
                .collection("conversations")
                .update(conversation.id, {
                messages: conversation.messages,
            });
        } catch (error) {
            console.log(error);
            if (error instanceof Error) {
                return { error: error.message };
            }

            return { error: "Unknown error occured when sending message" };
        }

        throw redirect(303, `/${params.conversation_id}`);
    },
    removeMessage: async ({locals, request, params}) => {
        const authModel = locals.pocketBase.authStore.model;

        if (!authModel || !validateUser(authModel)) {
            throw redirect(303, "/signup");
        }

        const formData = await request.formData();

        const messageId = formData.get("message-id");

        try {
            if (typeof messageId !== "string") {
                throw new Error(`Invalid message id`);
            }

            if (messageId.length === 0) {
                throw new Error(`Invalid message id`);
            }

            const conversationsCollection = locals.pocketBase.collection("conversations");

            let conversation: (RecordModel & Conversation) | undefined = await conversationsCollection.getOne(params.conversation_id);

            if (!conversation) {
                throw new Error(`Conversation not found`);
            }

            let isAdmin = conversation.admins.includes(authModel.id);

            let messageFound = conversation.messages.find(
                (msg) => msg.id === messageId
            );

            const userDoesNotOwnMessage = !(
                messageFound && messageFound.user_id === authModel.id
            );

            if (!isAdmin && userDoesNotOwnMessage) {
                throw new Error(
                `User does not have the permission to remove this message`
                );
            }

            let isImage = false;
            let imageURL = "";

            let messages = conversation.messages.filter((msg) => {
                const equals = msg.id !== messageId;

                if (!equals) {
                    isImage = msg.contentType === "image";
                    imageURL = msg.content;
                }

                return equals;
            });

            if (isImage) {
                await locals.pocketBaseAdmin
                    .collection("conversations")
                    .update(conversation.id, {
                        messages,
                        "message_photos-": [imageURL],
                    });
            } else {
                await locals.pocketBaseAdmin
                    .collection("conversations")
                    .update(conversation.id, {
                        messages,
                    });
            }
        } catch (error) {
            console.log(error);
            if (error instanceof Error) {
                return fail(500, { error: error.message });
            }

            return fail(500, { error: "Unknown error occured when sending message" });
        }

        throw redirect(303, `/${params.conversation_id}`);
    },
}
