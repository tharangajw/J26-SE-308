import React from 'react';

export const SafetyRequirementsSlide: React.FC = () => {
  const requirements = [
    {
      title: 'PII and secret scrubbing',
      description: 'Regex redaction of API keys, tokens, and IPs before any external LLM call.',
      accent: 'border-emerald-100',
      titleColor: 'text-emerald-700',
      background: 'bg-emerald-50',
    },
    {
      title: 'Server-side dry-run gate',
      description: 'All AI-generated Kubernetes patches must pass kubectl apply --dry-run=server.',
      accent: 'border-blue-100',
      titleColor: 'text-blue-700',
      background: 'bg-blue-50',
    },
    {
      title: 'Human-in-the-loop',
      description: 'Zero autonomous production changes without engineer approval.',
      accent: 'border-violet-100',
      titleColor: 'text-violet-700',
      background: 'bg-violet-50',
    },
  ];

  const highlights = [
    { value: '< 1%', label: 'CPU overhead from out-of-band polling' },
    { value: '< 6 ms', label: 'local inference latency' },
    { value: 'Stateless', label: 'containerized architecture' },
  ];

  return (
    <section className="rounded-xl bg-white px-5 py-5 text-slate-950 shadow-sm sm:px-7 sm:py-6" aria-label="Safety and requirements">
      <header>
        <h2 className="text-2xl font-black leading-tight tracking-tight text-blue-950 sm:text-3xl">
          Safety and requirements
        </h2>
        <p className="mt-1 text-sm font-medium text-blue-800 sm:text-base">
          Prediction is not permission.
        </p>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {requirements.map((requirement) => (
          <article
            key={requirement.title}
            className={`min-h-32 rounded-xl border ${requirement.accent} ${requirement.background} p-4`}
          >
            <h3 className={`text-sm font-extrabold ${requirement.titleColor}`}>
              {requirement.title}
            </h3>
            <p className="mt-5 max-w-xs text-xs font-medium leading-relaxed text-slate-950 sm:text-sm">
              {requirement.description}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-5 py-4">
        <h3 className="text-sm font-black text-rose-900 sm:text-base">
          Non-functional highlights
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {highlights.map((highlight) => (
            <article key={highlight.value} className="min-w-0">
              <p className="text-2xl font-black leading-none text-rose-800 sm:text-3xl">
                {highlight.value}
              </p>
              <p className="mt-3 text-xs font-medium leading-snug text-slate-950 sm:text-sm">
                {highlight.label}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
