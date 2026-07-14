"use client";

import { useId, useState } from "react";

type Props = {
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  labels: {
    edit: string;
    title: string;
    save: string;
    cancel: string;
  };
};

export function ProjectTitleEditor({ title, action, labels }: Props) {
  const [editing, setEditing] = useState(false);
  const inputId = useId();

  if (!editing) {
    return (
      <div className="flex min-w-0 items-start gap-3">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <button
          className="mt-1 shrink-0 rounded border border-[#dedbd2] px-3 py-1 text-xs text-[#1d1d1b]"
          type="button"
          onClick={() => setEditing(true)}
        >
          {labels.edit}
        </button>
      </div>
    );
  }

  return (
    <form className="min-w-0 flex-1" action={action}>
      <label className="sr-only" htmlFor={inputId}>
        {labels.title}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          className="min-w-48 flex-1 rounded border bg-white px-3 py-2"
          name="title"
          defaultValue={title}
          maxLength={120}
          required
          autoFocus
        />
        <button className="shrink-0 rounded bg-black px-4 py-2 text-sm text-white" type="submit">
          {labels.save}
        </button>
        <button
          className="shrink-0 rounded border border-[#dedbd2] px-4 py-2 text-sm text-[#1d1d1b]"
          type="button"
          onClick={() => setEditing(false)}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
