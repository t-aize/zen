"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
	const handleDiscordLogin = async () => {
		await authClient.signIn.social(
			{
				provider: "discord",
				callbackURL: "/dashboard",
			},
			{
				onError: (error) => {
					toast.error(error.error.message || "Failed to sign in with Discord");
				},
			},
		);
	};

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">Welcome</h1>
			<Button onClick={handleDiscordLogin} className="w-full">
				Sign in with Discord
			</Button>
		</div>
	);
}
