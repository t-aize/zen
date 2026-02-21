import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHero() {
	return (
		<section className="relative overflow-hidden py-20 md:py-28">
			{/* Zen gradient background - warm to cool like the logo */}
			<div className="pointer-events-none absolute inset-0 -z-10">
				{/* Base gradient */}
				<div className="absolute inset-0 bg-gradient-to-b from-amber-50/80 via-background to-teal-50/30 dark:from-amber-950/30 dark:via-background dark:to-teal-950/20" />
				{/* Soft orbs */}
				<div className="absolute -left-32 top-0 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-orange-200/40 to-rose-200/20 blur-3xl dark:from-orange-900/20 dark:to-rose-900/10" />
				<div className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-cyan-200/40 to-teal-200/20 blur-3xl dark:from-cyan-900/20 dark:to-teal-900/10" />
			</div>

			<div className="container relative mx-auto max-w-4xl px-4">
				<div className="flex flex-col items-center text-center">
					{/* Logo with subtle animation */}
					<div className="mb-10 md:mb-12">
						<div className="relative">
							<div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-orange-500/20 to-cyan-500/20 blur-2xl" />
							<Image
								src="/logo.png"
								alt="Zen"
								width={140}
								height={140}
								className="relative rounded-3xl shadow-2xl shadow-black/10"
								priority
							/>
						</div>
					</div>

					{/* Main tagline */}
					<h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
						Simply powerful.
						<br />
						<span className="bg-gradient-to-r from-amber-600 via-orange-500 to-cyan-600 bg-clip-text text-transparent dark:from-amber-400 dark:via-orange-400 dark:to-cyan-400">
							Purely open-source.
						</span>
					</h1>

					<p className="mb-10 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
						The ultimate all-in-one Discord bot. Moderation, economy, tickets,
						games, and more — no premium, no paywalls. Just zen.
					</p>

					{/* CTA Buttons */}
					<div className="flex flex-col gap-4 sm:flex-row">
						<Button size="lg" className="px-8" asChild>
							<Link href="#">
								Add to Discord
								<ArrowRightIcon className="ml-2 h-4 w-4" />
							</Link>
						</Button>
						<Button size="lg" variant="outline" className="px-8" asChild>
							<Link href="/dashboard">Dashboard</Link>
						</Button>
					</div>

					{/* Trust badges */}
					<div className="mt-12 flex items-center gap-6 text-sm text-muted-foreground">
						<span className="flex items-center gap-1.5">
							<span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
							100% Free
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
							Open Source
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
							No Paywalls
						</span>
					</div>
				</div>
			</div>

		</section>
	);
}
