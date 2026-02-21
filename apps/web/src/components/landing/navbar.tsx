import Link from "next/link";
import Image from "next/image";
import { GithubIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
	return (
		<header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-md">
			<div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
				<Link href="/" className="flex items-center gap-2.5">
					<Image
						src="/logo.png"
						alt="Zen"
						width={28}
						height={28}
						className="rounded-lg"
					/>
					<span className="font-semibold tracking-tight">Zen</span>
				</Link>

				<nav className="hidden items-center gap-6 text-sm md:flex">
					<Link
						href="#features"
						className="text-muted-foreground transition-colors hover:text-foreground"
					>
						Features
					</Link>
					<Link
						href="#"
						className="text-muted-foreground transition-colors hover:text-foreground"
					>
						Docs
					</Link>
					<Link
						href="https://github.com"
						className="text-muted-foreground transition-colors hover:text-foreground"
					>
						<GithubIcon className="h-4 w-4" />
					</Link>
				</nav>

				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" asChild>
						<Link href="/login">Login</Link>
					</Button>
					<Button size="sm" asChild>
						<Link href="/dashboard">Dashboard</Link>
					</Button>
				</div>
			</div>
		</header>
	);
}
