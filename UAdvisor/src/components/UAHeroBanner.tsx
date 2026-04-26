interface Props {
  title: string;
  description: string;
}

export const UAHeroBanner = ({ title, description }: Props) => {
  return (
    <section className="ua-hero-banner">
      <div className="container relative z-10 py-10 md:py-14">
        <h1
          className="text-4xl md:text-5xl font-bold text-primary-foreground"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          {title}
        </h1>
        <p className="mt-3 text-primary-foreground/90 text-base md:text-lg max-w-3xl">
          {description}
        </p>
      </div>
    </section>
  );
};
