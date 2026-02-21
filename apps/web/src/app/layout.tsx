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
	title: "zen",
	description: "zen",
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
					<Providers>
						<div className="grid h-svh grid-rows-[auto_1fr]">{children}</div>
					</Providers>
				</TooltipProvider>
			</body>
		</html>
	);
}
