import type { Metadata } from "next";

import { Geist, Geist_Mono, Inter } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Zen - Discord Moderation Bot",
	description:
		"A powerful, easy-to-use moderation bot for your Discord server. Warnings, logs, and more — all in one place.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning className={inter.variable}>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<TooltipProvider>
					<Providers>{children}</Providers>
				</TooltipProvider>
			</body>
		</html>
	);
}
