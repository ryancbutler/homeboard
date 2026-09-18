"use client";

import { Trash2 } from "lucide-react";
import { useParentControllerContext } from "./parent-controller";

export function FamilyTab() {
  const {
    busy,
    addChild,
    deleteChild,
    children,
  } = useParentControllerContext();
  return (<section className="management-card">
            <p className="eyebrow">YOUR HOME TEAM</p>
            <h2>Children</h2>
            <p className="integration-copy">Add and manage children in your household. Parents manage everything through PIN protection.</p>
            <div className="member-list">
              {children.map((child) => (
                <div className="member" key={child.id}>
                  <i style={{ background: child.color }} />
                  <span>{child.displayName}</span>
                  <small>Child</small>
                  <button
                    type="button"
                    className="member-delete-button"
                    aria-label={`Delete child ${child.displayName}`}
                    title={`Delete ${child.displayName}`}
                    disabled={Boolean(busy)}
                    onClick={() => deleteChild(child.id, child.displayName)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {!children.length && <p className="form-hint">No children added yet. Add one below!</p>}
            </div>
            <form className="add-child" onSubmit={addChild}>
              <label>Child name<input required name="name" placeholder="First name" /></label>
              <label>Color<input name="color" type="color" defaultValue="#8B71CB" /></label>
              <button className="primary" disabled={Boolean(busy)}>{busy === "child" ? "Adding…" : "Add child"}</button>
            </form>
          </section>);
}
