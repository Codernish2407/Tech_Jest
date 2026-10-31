import Link from "next/link";

export function ProjectBlueprint() {
  return (
    <aside className="project-blueprint" aria-labelledby="blueprint-title">
      <div className="blueprint-topline">
        <span>TechJest / Our approach</span>
        <span aria-hidden="true">↗</span>
      </div>
      <h2 id="blueprint-title">
        A clear path
        <br />
        from idea to launch.
      </h2>
      <ol className="blueprint-steps">
        <li>
          <span aria-hidden="true">01</span>
          <div>
            <h3>Start with the goal</h3>
            <p>Your business, your users, your priorities.</p>
          </div>
        </li>
        <li>
          <span aria-hidden="true">02</span>
          <div>
            <h3>Shape the experience</h3>
            <p>A clear scope and thoughtful design.</p>
          </div>
        </li>
        <li>
          <span aria-hidden="true">03</span>
          <div>
            <h3>Build, test, improve</h3>
            <p>Useful software, with care at every step.</p>
          </div>
        </li>
      </ol>
      <div className="blueprint-footer">
        <span>Made around your business.</span>
        <Link href="/services">
          Find your starting point <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}
