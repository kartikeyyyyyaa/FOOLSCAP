/**
 * Illustrative feedback, labelled as such on the page.
 *
 * These are not real users and nothing here claims a user count. They exist to
 * show the kind of feedback the product is built around. Swap them for real
 * quotes, with permission, once there are real users.
 */
const REVIEWS = [
  {
    q: "The bit that got me was the comparison. I thought I had improved on paging and it showed me I had only improved on the easy section.",
    m: "Second year, Computer Science",
  },
  {
    q: "I stopped ticking things off and started answering for them. The list of what I had actually revised got much shorter and much more honest.",
    m: "Third year, Electronics",
  },
  {
    q: "Dropping a slide deck in and getting questions written from that deck, not from the internet, is the whole thing for me.",
    m: "First year, Mechanical",
  },
  {
    q: "The 48 hour re-prove is annoying in the right way. It caught two topics I would have walked into the exam assuming I knew.",
    m: "Final year, Biotechnology",
  },
  {
    q: "It sends me back to one section instead of the whole chapter. That alone saves me an hour a night.",
    m: "Second year, Civil",
  },
  {
    q: "I used it on a handout the night before a quiz and the traps section had two of the exact things I would have got wrong.",
    m: "Third year, Chemistry",
  },
  {
    q: "The streak is the only reason I opened it on a Sunday. I am not proud of that but it worked.",
    m: "Second year, Mathematics",
  },
  {
    q: "Being told my mistakes were concentrated rather than scattered changed how I revised that week.",
    m: "First year, Physics",
  },
];

function Card({ q, m }: { q: string; m: string }) {
  return (
    <figure className="review">
      <blockquote className="review-q">{q}</blockquote>
      <figcaption className="review-who">
        <span className="review-mark" aria-hidden="true">
          &ldquo;
        </span>
        <span>
          <span className="review-name">Illustrative</span>
          <br />
          <span className="review-meta">{m}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export default function Reviews() {
  const half = Math.ceil(REVIEWS.length / 2);
  const rowA = REVIEWS.slice(0, half);
  const rowB = REVIEWS.slice(half);

  return (
    <>
      <div className="marquee-label">
        <span className="pill" data-tone="shaky">
          Illustrative
        </span>
        <span>
          Written to show the kind of feedback Foolscap is built for. These are not real users, and
          there is no user count to quote yet.
        </span>
      </div>

      {[rowA, rowB].map((row, i) => (
        <div className="marquee" data-dir={i === 1 ? "back" : undefined} key={i}>
          {/* Duplicated so the track can loop by translating exactly half its width. */}
          <div className="marquee-track">
            {[...row, ...row].map((r, j) => (
              <Card key={`${i}-${j}`} q={r.q} m={r.m} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
