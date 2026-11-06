import { requireUser } from "@/lib/auth";
import { JobEditor } from "@/components/JobEditor";

export default async function NewJobPage() {
  const user = await requireUser("homeowner");
  return (
    <main className="container stack">
      <h1>New job</h1>
      <p className="muted">Tip: it&apos;s faster to describe the problem to Claude with photos. It writes these lines for you.</p>
      <div className="card">
        <JobEditor
          job={{
            title: "",
            category: "leaks_plumbing",
            city: user.city,
            locality: "",
            summary: "",
            urgency: "this_month",
            budget_min: null,
            budget_max: null,
            site_visit_questions: [],
            items: [{ description: "", quantity: 1, unit: "job", notes: "" }],
          }}
        />
      </div>
    </main>
  );
}
