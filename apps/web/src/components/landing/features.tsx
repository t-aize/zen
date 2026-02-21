import {
	ShieldCheckIcon,
	HammerIcon,
	TicketIcon,
	CoinsIcon,
	SparklesIcon,
	GiftIcon,
	BarChart3Icon,
	GamepadIcon,
} from "lucide-react";

const features = [
	{
		icon: ShieldCheckIcon,
		title: "Security & Anti-Raid",
		description: "Advanced protection against bad actors and raids.",
	},
	{
		icon: HammerIcon,
		title: "Moderation",
		description: "Powerful auto-mod and manual tools for balance.",
	},
	{
		icon: TicketIcon,
		title: "Ticket System",
		description: "Clean and organized support for your members.",
	},
	{
		icon: CoinsIcon,
		title: "Economy & Leveling",
		description: "Engaging RPG elements to keep members active.",
	},
	{
		icon: SparklesIcon,
		title: "Utility",
		description: "Reaction roles, logs, and welcome messages.",
	},
	{
		icon: GiftIcon,
		title: "Events & Giveaways",
		description: "Host exciting events with ease.",
	},
	{
		icon: BarChart3Icon,
		title: "Analytics",
		description: "Insights into your server's activity and growth.",
	},
	{
		icon: GamepadIcon,
		title: "Games",
		description: "Keep your community entertained.",
	},
];

export function LandingFeatures() {
	return (
		<section id="features" className="bg-muted/50 py-20 md:py-28">
			<div className="container mx-auto max-w-5xl px-4">
				{/* Section header */}
				<div className="mb-16 text-center">
					<p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
						All-in-one solution
					</p>
					<h2 className="mb-4 text-3xl font-bold md:text-4xl">
						One bot. Endless possibilities.
					</h2>
					<p className="mx-auto max-w-2xl text-muted-foreground">
						Zen replaces dozens of bots by integrating the best tools into one
						single, serene experience. No more juggling multiple bots.
					</p>
				</div>

				{/* Features grid */}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{features.map((feature) => (
						<div
							key={feature.title}
							className="group rounded-2xl border border-border/50 bg-background/50 p-6 backdrop-blur-sm transition-all hover:border-border hover:bg-background hover:shadow-lg"
						>
							<div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-amber-500/10 to-cyan-500/10 p-3">
								<feature.icon className="h-6 w-6 text-foreground/80" />
							</div>
							<h3 className="mb-2 font-semibold">{feature.title}</h3>
							<p className="text-sm leading-relaxed text-muted-foreground">
								{feature.description}
							</p>
						</div>
					))}
				</div>

				{/* Bottom note */}
				<p className="mt-12 text-center text-sm text-muted-foreground">
					And much more — custom commands, multilingual support, customizable
					settings...
				</p>
			</div>

		</section>
	);
}
