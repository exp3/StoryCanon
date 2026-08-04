"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

type Labels = {
  trigger: string;
  heading: string;
  body: string;
  confirm: string;
  deleting: string;
  cancel: string;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  projectTitle: string;
  labels: Labels;
};

export function DeleteProjectDialog({ action, projectTitle, labels }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Set synchronously on submit: `pending` only flips on the next render, which
  // would let a double click fire a second DELETE and land on the 404 page.
  const submittedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const headingId = useId();
  const descriptionId = useId();

  // <dialog> is only modal (focus trap, inert background, Escape) when opened
  // through showModal(), so the React state drives the imperative API.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        className="w-full rounded border border-[#e3b8b3] px-3 py-2 text-center text-sm text-[#a3352b]"
        type="button"
        onClick={() => setOpen(true)}
      >
        {labels.trigger}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="w-[min(28rem,calc(100vw-2rem))] rounded border bg-white p-6 text-[#1d1d1b] backdrop:bg-black/40"
        // Escape fires cancel before close: while the delete is in flight the
        // dialog must stay put, otherwise it looks like the delete was aborted.
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        // Fires for Escape as well as close(), keeping React state in sync.
        onClose={() => setOpen(false)}
      >
        <h2 id={headingId} className="text-lg font-semibold">
          {labels.heading}
        </h2>
        <div id={descriptionId}>
          <p className="mt-3 break-words text-sm font-medium">{projectTitle}</p>
          <p className="mt-2 text-sm leading-6 text-[#555]">{labels.body}</p>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {pending ? labels.deleting : ""}
        </p>
        <form
          action={(formData) => {
            if (submittedRef.current) return;
            submittedRef.current = true;
            startTransition(async () => {
              try {
                // Deliberately never caught: a successful delete rejects this
                // promise with Next's redirect signal, which has to reach the
                // router's redirect boundary to navigate. `finally` re-throws.
                await action(formData);
              } finally {
                submittedRef.current = false;
              }
            });
          }}
        >
          <div className="mt-6 flex justify-end gap-2">
            {/* aria-disabled rather than disabled: disabling the focused button
                would drop focus out of the modal, leaving nothing to tab to. */}
            <button
              className="rounded border border-[#dedbd2] px-4 py-2 text-sm text-[#1d1d1b] aria-disabled:opacity-50"
              type="button"
              aria-disabled={pending}
              onClick={() => {
                if (!pending) setOpen(false);
              }}
            >
              {labels.cancel}
            </button>
            <button
              className="rounded bg-[#a3352b] px-4 py-2 text-sm text-white aria-disabled:opacity-50"
              type="submit"
              aria-disabled={pending}
            >
              {pending ? labels.deleting : labels.confirm}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
