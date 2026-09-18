"use client";

import { Download, FileJson, FileUp, Home, KeyRound, Upload, X } from "lucide-react";
import { useParentControllerContext } from "./parent-controller";

export function SettingsTab() {
  const {
    groups,
    dashboard,
    busy,
    importFile,
    setImportFile,
    dragOver,
    setDragOver,
    fileInputRef,
    updateHouseholdSettings,
    changePin,
    handleExport,
    clearImportFile,
    handleImport,
    children,
  } = useParentControllerContext();
  return (<div className="settings-stack">
            {/* Card 1: Board & Security */}
            <section className="management-card">
              <p className="eyebrow">CUSTOMIZE & PROTECT</p>
              <h2>Board & Security</h2>
              <p className="form-hint">Customize your board display and update parent access.</p>

              {dashboard && (
                <form onSubmit={updateHouseholdSettings} className="settings-section-form">
                  <div className="two-col">
                    <label>
                      Family name
                      <input required maxLength={100} name="householdName" defaultValue={dashboard.household.name} placeholder="e.g. The Johnson Home" />
                    </label>
                    <label>
                      Sub-saying
                      <input required maxLength={200} name="subheading" defaultValue={dashboard.household.subheading} placeholder="e.g. Your people. Your little wins. Your home, together." />
                    </label>
                  </div>
                  <div className="settings-toggles">
                    <label className="check">
                      <input name="showBanner" type="checkbox" defaultChecked={dashboard.household.showBanner} />
                      Show big hero banner on board
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="primary" disabled={busy === "household-settings"}>
                      {busy === "household-settings" ? "Saving…" : "Save board settings"}
                    </button>
                  </div>
                </form>
              )}

              <hr className="settings-divider" />

              <div className="settings-subgroup">
                <h3>Parent PIN</h3>
                <p className="form-hint">Change the 4-digit PIN required to unlock Parent mode.</p>
                <form onSubmit={changePin} className="pin-inline-row">
                  <label className="inline-label">
                    <span>New PIN</span>
                    <input required type="password" name="newPin" maxLength={20} placeholder="New 4-digit PIN" />
                  </label>
                  <button className="secondary" disabled={busy === "change-pin"}>
                    <KeyRound size={15} aria-hidden="true" />
                    {busy === "change-pin" ? "Updating…" : "Update PIN"}
                  </button>
                </form>
              </div>
            </section>

            {/* Card 2: Backup & Restore */}
            <section className="management-card">
              <p className="eyebrow">DATA MANAGEMENT</p>
              <h2>Move your setup</h2>
              <p className="form-hint">
                Export the household setup, or add its missing pieces to another household. Completion history is not included.
              </p>

              <div className="backup-streamlined">
                <div className="backup-row">
                  <div>
                    <strong>Export setup</strong>
                    <p className="form-hint">Download children, chore and routine schedules, checklist steps, and groups as JSON.</p>
                  </div>
                  <button type="button" className="secondary" onClick={handleExport}>
                    <Download size={16} aria-hidden="true" />
                    Download setup file
                  </button>
                </div>

                <hr className="settings-divider" />

                <div className="backup-row">
                  <div>
                    <strong>Import setup</strong>
                    <p className="form-hint">Adds missing items only. Matching chore and routine names stay unchanged; history is never replaced.</p>
                  </div>
                  <form onSubmit={handleImport} className="import-inline-form">
                    <div
                      className={`file-picker-control ${dragOver ? "drag-over" : ""} ${importFile ? "has-file" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && (file.type === "application/json" || file.name.endsWith(".json"))) {
                          setImportFile(file);
                        }
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        id="backup-file-input"
                        type="file"
                        accept=".json,application/json"
                        required
                        className="file-input-hidden"
                        onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                      />
                      <label
                        htmlFor="backup-file-input"
                        className="file-picker-trigger"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        <FileUp size={15} aria-hidden="true" />
                        <span>{importFile ? "Change file" : "Choose file"}</span>
                      </label>
                      <div className="file-picker-status">
                        {importFile ? (
                          <div className="file-selected-info">
                            <FileJson size={15} className="file-badge-icon" aria-hidden="true" />
                            <span className="file-selected-name" title={importFile.name}>{importFile.name}</span>
                            <span className="file-selected-size">({(importFile.size / 1024).toFixed(1)} KB)</span>
                            <button
                              type="button"
                              className="file-clear-btn"
                              aria-label="Remove selected file"
                              title="Remove file"
                              onClick={clearImportFile}
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span className="file-placeholder">No file chosen</span>
                        )}
                      </div>
                    </div>
                    <button className="primary" disabled={!importFile || busy === "import"}>
                      <Upload size={16} aria-hidden="true" />
                      {busy === "import" ? "Importing…" : "Import setup"}
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>);
}
