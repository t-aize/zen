import Link from "next/link";
import Image from "next/image";
import { GithubIcon, HeartIcon } from "lucide-react";

export function LandingFooter() {
	return (
		<footer className="border-t border-border/40 py-12">
			<div className="container mx-auto max-w-5xl px-4">
				<div className="flex flex-col items-center justify-between gap-6 md:flex-row">
					{/* Logo & tagline */}
					<div className="flex items-center gap-3">
						<Image
							src="/logo.png"
							alt="Zen"
							width={32}
							height={32}
							className="rounded-lg"
						/>
						<div className="flex flex-col">
							<span className="font-medium">Zen</span>
							<span className="text-xs text-muted-foreground">
								Simply powerful, purely open-source
							</span>
						</div>
					</div>

					{/* Links */}
					<nav className="flex items-center gap-6 text-sm">
						<Link
							href="https://github.com"
							className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
						>
							<GithubIcon className="h-4 w-4" />
							GitHub
						</Link>
						<Link
							href="#"
							className="text-muted-foreground transition-colors hover:text-foreground"
						>
							Documentation
						</Link>
						<Link
							href="#"
							className="text-muted-foreground transition-colors hover:text-foreground"
						>
							Support
						</Link>
					</nav>
				</div>

				{/* Bottom */}
				<div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-8 text-xs text-muted-foreground md:flex-row">
					<p>Apache License 2.0</p>
					<p className="flex items-center gap-1">
						Built with <HeartIcon className="h-3 w-3 fill-current text-red-500" /> for the Discord community
					</p>
				</div>
			</div>
		</footer>
	);
}
