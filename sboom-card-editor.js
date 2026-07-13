/**
 * Редактор конфигурации sboom-card (GUI в Lovelace).
 * Тот же Lit-runtime и токены, что у карточки/панели (импорт из статики sboom_ha).
 * Эмитит стандартное событие `config-changed` при изменениях.
 */
import { LitElement, html, css } from "/sboom_panel/lit-base.js";
import { tokens } from "/sboom_panel/components/sboom-tokens.css.js";

class SboomCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      _devices: { type: Array },
    };
  }

  constructor() {
    super();
    this._config = {};
    this._devices = [];
    this._devicesLoaded = false;
  }

  setConfig(config) {
    this._config = { ...config };
  }

  updated(changed) {
    if (changed.has("hass") && this.hass && !this._devicesLoaded) {
      this._devicesLoaded = true;
      this.hass
        .callWS({ type: "sboom/devices" })
        .then((res) => {
          this._devices = res?.devices || [];
        })
        .catch(() => {
          this._devices = [];
        });
    }
  }

  _emit(patch) {
    this._config = { ...this._config, ...patch };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const c = this._config || {};
    return html`
      <div class="form">
        <label class="field">
          <span class="lbl">Колонка</span>
          <select
            @change=${(e) =>
              this._emit({ entry_id: e.target.value || undefined })}
          >
            <option value="" ?selected=${!c.entry_id}>
              — первая доступная —
            </option>
            ${this._devices.map(
              (d) => html`<option
                value=${d.entry_id}
                ?selected=${c.entry_id === d.entry_id}
              >
                ${d.name}
              </option>`
            )}
          </select>
        </label>

        <label class="field">
          <span class="lbl">Режим</span>
          <select @change=${(e) => this._emit({ mode: e.target.value })}>
            <option value="compact" ?selected=${(c.mode || "compact") === "compact"}>
              Компактный
            </option>
            <option value="full" ?selected=${c.mode === "full"}>
              Полный (с каталогом)
            </option>
          </select>
        </label>

        <label class="field row">
          <input
            type="checkbox"
            .checked=${c.show_browse ?? c.mode === "full"}
            @change=${(e) => this._emit({ show_browse: e.target.checked })}
          />
          <span class="lbl">Раскрыть каталог (поиск/очередь)</span>
        </label>

        <p class="hint">
          Карточке нужна установленная интеграция <b>sboom_ha</b> (WS-API + общие
          компоненты). Если колонок несколько — задайте нужную здесь.
        </p>
      </div>
    `;
  }

  static get styles() {
    return [
      tokens,
      css`
        .form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          color: var(--sb-ink);
          font-family: system-ui, "Segoe UI", Roboto, sans-serif;
          padding: 4px 2px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field.row {
          flex-direction: row;
          align-items: center;
          gap: 10px;
        }
        .lbl {
          font-size: 13px;
          color: var(--sb-ink-dim);
        }
        select {
          appearance: none;
          background: var(--sb-elev);
          color: var(--sb-ink);
          border: 1px solid var(--sb-line);
          border-radius: var(--sb-radius-sm);
          font: inherit;
          font-size: 14px;
          padding: 9px 12px;
          cursor: pointer;
        }
        input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--sb-accent);
        }
        .hint {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--sb-ink-faint);
          line-height: 1.5;
        }
      `,
    ];
  }
}

customElements.define("sboom-card-editor", SboomCardEditor);
