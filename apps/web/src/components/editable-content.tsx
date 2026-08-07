"use client";

import { useState, type ReactNode } from "react";

export type EditableField = {
  name: string;
  label: string;
  value: string;
  kind?: "text" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  // Mirrors the server-side zod cap. Without it an over-long paste only fails
  // once submitted, and the error unmounts the form along with everything the
  // author had typed into the other fields.
  maxLength?: number;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  fields: EditableField[];
  labels: { edit: string; save: string; cancel: string };
  children: ReactNode;
};

export function EditableContent({ action, fields, labels, children }: Props) {
  const [editing, setEditing] = useState(false);

  // The server action redirects back to the same route, which re-renders this
  // component with the saved values but leaves `editing` — and the already
  // dirty inputs — untouched. Without this the form stays open still showing
  // the pre-edit text, so a successful save looks like it did nothing.
  const saved = JSON.stringify(fields.map((field) => field.value));
  const [lastSaved, setLastSaved] = useState(saved);
  if (lastSaved !== saved) {
    setLastSaved(saved);
    setEditing(false);
  }

  if (!editing) {
    return (
      <>
        <div className="mb-2 flex justify-end">
          <button className="rounded border border-[#dedbd2] px-3 py-1 text-xs text-[#1d1d1b]" type="button" onClick={() => setEditing(true)}>
            {labels.edit}
          </button>
        </div>
        {children}
      </>
    );
  }

  return (
    <form className="space-y-4" action={action}>
      {fields.map((field) => (
        <label className="block" key={field.name}>
          <span className="text-sm font-medium">{field.label}</span>
          {field.kind === "select" ? (
            <select className="mt-1 w-full rounded border px-3 py-2" name={field.name} defaultValue={field.value} required={field.required}>
              {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : field.kind === "textarea" ? (
            <textarea className="mt-1 min-h-24 w-full rounded border px-3 py-2" name={field.name} defaultValue={field.value} required={field.required} maxLength={field.maxLength} />
          ) : (
            <input className="mt-1 w-full rounded border px-3 py-2" name={field.name} defaultValue={field.value} required={field.required} maxLength={field.maxLength} />
          )}
        </label>
      ))}
      <div className="flex gap-2">
        <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">{labels.save}</button>
        <button className="rounded border border-[#dedbd2] px-4 py-2 text-sm" type="button" onClick={() => setEditing(false)}>{labels.cancel}</button>
      </div>
    </form>
  );
}
