import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import ColorPicker from "@/components/ColorPicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBoard } from "@/lib/board/store";
import type { Project } from "@/lib/board/types";
import { DEFAULT_PROJECT_COLOR, PALETTE } from "@/lib/color";
import { useT } from "@/lib/i18n/I18nProvider";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edits the project; otherwise creates one and opens its board. */
  project?: Project | null;
}

/** Label rows live directly on the dialog: rename inline, recolor with the
 *  native input, delete strips the label from every task. */
function LabelManager({ project }: { project: Project }) {
  const { addLabel, updateLabel, deleteLabel } = useBoard();
  const t = useT();
  const L = t.kairos.projectDialog;
  const [newName, setNewName] = useState("");

  function create() {
    const name = newName.trim();
    if (!name) return;
    addLabel(project.id, { name, color: PALETTE[(project.labels.length + 2) % PALETTE.length].hex });
    setNewName("");
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.labels}</Label>
      <div className="space-y-1.5">
        {project.labels.map((label) => (
          <div key={label.id} className="flex items-center gap-2">
            <label className="relative h-6 w-6 shrink-0 cursor-pointer rounded-full" style={{ background: label.color }} title={L.labelColor}>
              <input
                type="color"
                value={label.color}
                onChange={(e) => updateLabel(project.id, label.id, { color: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={`${L.labelColor}: ${label.name}`}
              />
            </label>
            <Input
              value={label.name}
              onChange={(e) => updateLabel(project.id, label.id, { name: e.target.value })}
              className="h-8 flex-1"
              aria-label={L.labelName}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={L.deleteLabel(label.name)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => deleteLabel(project.id, label.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-border" />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
            placeholder={L.newLabel}
            className="h-8 flex-1"
          />
          <Button type="button" variant="ghost" size="icon" aria-label={L.addLabel} className="h-8 w-8" onClick={create} disabled={!newName.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  const { createProject, updateProject } = useBoard();
  const navigate = useNavigate();
  const t = useT();
  const L = t.kairos.projectDialog;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_PROJECT_COLOR);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setColor(project?.color ?? DEFAULT_PROJECT_COLOR);
    }
  }, [open, project]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (project) {
      updateProject(project.id, { name: name.trim(), description: description.trim() || undefined, color });
    } else {
      const id = createProject({ name, description, color });
      navigate(`/projects/${id}`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{project ? L.editTitle : L.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.name}</Label>
            <Input id="project-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={L.namePlaceholder} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.description}</Label>
            <Textarea id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={L.descriptionPlaceholder} rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.color}</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {project ? (
            <LabelManager project={project} />
          ) : (
            <p className="text-[11px] text-muted-foreground">{L.labelsHintNew}</p>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
            <Button type="submit" disabled={!name.trim()} className="bg-primary text-primary-foreground hover:bg-primary-deep">
              {project ? L.saveChanges : L.createProject}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
