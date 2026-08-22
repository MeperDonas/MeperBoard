import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { parseLocalCardId, type Card } from "../../state";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { CardMetaRow } from "../ui/card-meta";
import type { BacklogLocalActions } from "./backlog";

export interface BacklogRowProps {
  card: Card;
  localActions?: BacklogLocalActions;
  onEdit: () => void;
}

export function BacklogRowContent({ card, localActions, onEdit }: BacklogRowProps) {
  const localId = parseLocalCardId(card.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleDeleteClick() {
    if (!localId || !localActions?.onDeleteLocal) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    localActions.onDeleteLocal(localId);
    setConfirmingDelete(false);
  }

  return (
    <>
      <div className="min-w-0 flex-1">
        <p
          data-testid="backlog-title"
          className="truncate text-sm font-medium leading-snug"
          title={card.title}
        >
          {card.title}
        </p>
        <div className="mt-1 flex w-full items-center gap-2">
          <CardMetaRow
            card={card}
            trailing={
              <>
                {card.labels.map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </>
            }
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {card.htmlUrl != null && (
          <a
            href={card.htmlUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${card.title} on GitHub`}
            title="Open on GitHub"
            className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
        {localId != null && localActions?.onEditLocal != null && (
          <button
            type="button"
            aria-label={`Edit ${card.title}`}
            title="Edit"
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {localId != null && localActions?.onDeleteLocal != null && (
          confirmingDelete ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                aria-label={`Confirm delete ${card.title}`}
                onClick={handleDeleteClick}
                onBlur={() => setConfirmingDelete(false)}
                className="h-7 px-2 text-xs"
              >
                Delete?
              </Button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Delete ${card.title}`}
              title="Delete"
              onClick={handleDeleteClick}
              className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )
        )}
      </div>
    </>
  );
}
