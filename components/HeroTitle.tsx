// "4th Grade" kicker + "Band Carpool" in script with a yellow brush underline.
export default function HeroTitle({ school, title }: { school: string; title: string }) {
  const words = title.split(" ");
  const tail = words.length > 2 ? words.slice(-2).join(" ") : title;
  const head = words.length > 2 ? words.slice(0, -2).join(" ") : "";
  return (
    <>
      <div className="eyebrow">{school}</div>
      {head && <div className="hero-kicker">{head}</div>}
      <h1 className="hero-script">{tail}</h1>
      <svg className="brush" viewBox="0 0 420 22" preserveAspectRatio="none" aria-hidden="true">
        <path d="M4 15 C 90 5, 220 3, 416 9 L 414 14 C 250 11, 120 13, 8 20 Z" />
      </svg>
    </>
  );
}
