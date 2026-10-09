

class WasherDryerCardEditor extends HTMLElement {

  setConfig(config) {
    this._config = { ...config };
    this._rendered = false;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;

    if (!this._rendered) {
      this._render();
    }
  }

  _render() {
    if (!this._hass || !this._config || this._rendered) {
      return;
    }

    this._rendered = true;

    this.innerHTML = "";

    const style = document.createElement("style");
    
    style.textContent = `
      ha-entity-picker {
        display: block;
        width: 100%;
        margin-bottom: 16px;
      }
    `;
    
    this.appendChild(style);

    const variantSelect = document.createElement("ha-select");
    
    variantSelect.label = "Variant";
    variantSelect.style.width = "100%";
    variantSelect.style.marginBottom = "16px";
    
    const washerOption = document.createElement("ha-dropdown-item");
    washerOption.value = "Washer";
    washerOption.textContent = "Washer";
    
    const dryerOption = document.createElement("ha-dropdown-item");
    dryerOption.value = "Dryer";
    dryerOption.textContent = "Dryer";

    variantSelect.appendChild(washerOption);
    variantSelect.appendChild(dryerOption);
    variantSelect.addEventListener("selected", (ev) => {
      const selectedValue = ev.detail?.value;
    
      if (selectedValue !== "Washer" && selectedValue !== "Dryer") {
        return;
      }
    
      const variant = selectedValue.toLowerCase();
    
      this._config = {
        ...this._config,
        variant,
      };
    
      variantSelect.value = selectedValue;
      this._fireConfigChanged();
    });

    // Job state
    const jobStatePicker = document.createElement("ha-entity-picker");

    jobStatePicker.hass = this._hass;
    jobStatePicker.value =
      this._config.job_state_entity || "";

    jobStatePicker.label = "Job state entity";

    jobStatePicker.addEventListener("value-changed", (ev) => {
      this._config = {
        ...this._config,
        job_state_entity: ev.detail.value,
      };

      this._fireConfigChanged();
    });

    // Completion time
    const completionPicker = document.createElement("ha-entity-picker");

    completionPicker.hass = this._hass;
    completionPicker.value =
      this._config.completion_time_entity || "";

    completionPicker.label = "Completion time entity";

    completionPicker.addEventListener("value-changed", (ev) => {
      this._config = {
        ...this._config,
        completion_time_entity: ev.detail.value,
      };

      this._fireConfigChanged();
    });

    this.appendChild(variantSelect);
    this.appendChild(jobStatePicker);
    this.appendChild(completionPicker);
  }

  _fireConfigChanged() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: {
          config: this._config,
        },
        bubbles: true,
        composed: true,
      })
    );
  }
}
customElements.define(
  "washer-dryer-card-editor",
  WasherDryerCardEditor
);

class WasherDryerCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("washer-dryer-card-editor");
  }
  connectedCallback() {
    this.render();
  }

  set hass(hass) {
    this._hass = hass;

    if (!this._bubbleGroup || !this._heatGroup || !this._swirlGroup) {
      return;
    }
    const variant = this.config.variant;
    const jobStateEntity = hass.states[this.config.job_state_entity];
    const jobState = jobStateEntity?.state || "Unknown";

    const readableState = jobStateEntity ? this._hass.formatEntityState(jobStateEntity) : "Unknown";

    if (this._jobText && jobState != "none") {
      this._jobText.textContent = readableState;
    }
    else{
      this._jobText.textContent = "";
    }

    const completionEntity = hass.states[this.config.completion_time_entity];
    let remainingText = "--:--";
    if (completionEntity?.state && jobState != "none") {
      const completion = new Date(completionEntity.state);
      const now = new Date();
      const diffMs = completion - now;
      if (diffMs > 0) {
        const totalMinutes = Math.floor(diffMs / 1000 / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        remainingText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
      else{
        remainingText = "00:00";
      }
    }
    else{
      remainingText = "--:--";
    }
    if (this._timerText) {
      this._timerText.textContent = remainingText;
    }

    if (this.config.variant === "washer") {
      if (this._swirlGroup) {
        this._swirlGroup.classList.add("hidden");
      }
      if (this._heatGroup) {
        this._heatGroup.classList.add("hidden");
      }
      if (this._bubbleGroup) {
        this._bubbleGroup.classList.add("hidden");
      }

      switch (jobState) {
        case "stop":
          this._setBubbleState("stalled");
          this._setSwirlState(null);
          break;
        case "weightSensing":
          this._setBubbleState("stalled");
          this._setSwirlState("swirl-sense");
          break;
        case "rinse":
          this._setBubbleState("flow");
          this._setSwirlState("swirl-rinse");
          break;
        case "wash":
          this._setBubbleState("flow");
          this._setSwirlState("swirl-wash");
          break;
        case "spin":
          this._setBubbleState("stalled");
          this._setSwirlState("swirl-spin");
          break;
        case "finish":
          this._setBubbleState("stalled");
          this._setSwirlState(null);
          break;
        default:
          this._setBubbleState("stalled");
          this._setSwirlState(null);
          break;
      }
    }
    else if(this.config.variant === "dryer"){
      if (this._swirlGroup) {
        this._swirlGroup.classList.add("hidden");
      }
      if (this._heatGroup) {
        this._heatGroup.classList.add("hidden");
      }
      if (this._bubbleGroup) {
        this._bubbleGroup.classList.add("hidden");
      }
      switch (jobState) {
        case "stop":
          this._setHeatState(null);
          this._setSwirlState(null);
          break;
        case "drying":
          this._setHeatState("heat-anim");
          this._setSwirlState("swirl-wash");
          break;
        case "finish":
          this._setHeatState(null);
          this._setSwirlState(null);
          break;
        default:
          this._setHeatState(null);
          this._setSwirlState(null);
          break;
      }
    }
  }

  // The user supplied configuration. Throw an exception and Home Assistant
  // will render an error card.
  setConfig(config) {
    if (!config.variant) {
      throw new Error("Variant type required");
    }
  
    if (!config.job_state_entity) {
      throw new Error("Job state entity required");
    }
  
    if (!config.completion_time_entity) {
      throw new Error("Completion time entity required");
    }
  
    this.config = config;
  }

  // The height of your card. Home Assistant uses this to automatically
  // distribute all cards over the available columns in masonry view
  getCardSize() {
    return 3;
  }

  // receive the states updates and checks if the card needs a rerender
  _updateStates = (states, unsubscribe) => {
    // Store the unsubscribe function so we can call it when the card is removed from the DOM
    this._unsubscribe = unsubscribe;

    const entityId = this.config.entity;
    const state = states[entityId];
    const stateString = state ? state.state : "unavailable";
    if (this.stateString !== stateString) {
      this.stateString = stateString;
      this._render();
    }
  }

  _setSwirlState(newClass) {
    this._swirlGroup.classList.remove(
      "swirl-sense",
      "swirl-rinse",
      "swirl-wash",
      "swirl-spin"
    );
  
    if (newClass) {
      this._swirlGroup.classList.remove("hidden");
      this._swirlGroup.classList.add(newClass);
    }
  }

  _setBubbleState(state) {
    this._bubbleGroup.classList.remove("hidden");
    if (state == "stalled"){
      this._bubble1.classList.remove("bubble-flow-1");
      this._bubble2.classList.remove("bubble-flow-2");
      this._bubble3.classList.remove("bubble-flow-3");
    }
    else if (state == "flow") {
      this._bubble1.classList.add("bubble-flow-1");
      this._bubble2.classList.add("bubble-flow-2");
      this._bubble3.classList.add("bubble-flow-3");
    }
  }
  
  _setHeatState(newClass) {
    this._heatGroup.classList.remove("hidden");
    this._heatGroup.classList.remove(
      "heat-anim"
    );
  
    if (newClass) {
      this._heatGroup.classList.remove("hidden");
      this._heatGroup.classList.add(newClass);
    }
  }

  // renders the html of the card, just if needed
  render = () => {
    this.innerHTML = `
      <ha-card>
        <style>
          .machine-svg {
            transform: scale(1);
            transform-origin: top left;
          }
          .hidden {
            opacity: 0;
            pointer-events: none;
          }
          /*  Machine */
          .machine-group {
            display: block;
            margin: 0 auto;
          }
          .container {
            padding: 12px;
          }
          .remaining-time {
            position:absolute;
            color:light-dark(white, black);
            font-size: 3.5em;
            font-family: Courier New;
            font-weight: bold;
          }
          .job-state-text{
            position:absolute;
            text-anchor: middle;
            text-align: center;
            color: light-dark(white, black);
            font-size: 2.2em;
            font-family: Helvetica;
            font-weight: bold;
          } 
  
          /*  Swirl */
          .arc {
            fill: none;
            stroke: #ccc;
            stroke-width: 15;
            stroke-linecap: butt;
          
          }
          .left {
            transform: rotate(180deg);
            transform-origin: center;
          }
          .right {
            transform: rotate(0deg);
            transform-origin: center;
          }
          .outer {
            stroke: #ccc;
            stroke-dasharray: 133 400;  //130*2*pi
          }
          .inner {
            stroke: #ccc;
            stroke-dasharray: 102 306;   //90*2*pi
          }
          .swirl-spin {
            transform-origin: center;
            transform-box: fill-box;
            animation: spin 0.4s linear infinite;
          }
          .swirl-wash, .swirl-sense {
            transform-origin: center;
            transform-box: fill-box;
            animation: wash 8s ease-in-out infinite;
          }
          .swirl-rinse {
            transform-origin: center;
            transform-box: fill-box;
            animation: rinse 8s ease-in-out infinite;
          }
          @keyframes rinse {
            0% {
              transform: rotate(0deg);
            }
            50% {
              transform: rotate(360deg);
            }
            100% {
              transform: rotate(0deg);
            }
          }
          @keyframes wash {
            0% {
              transform: rotate(0deg);
            }
            50% {
              transform: rotate(720deg);
            }
            100% {
              transform: rotate(0deg);
            }
          }
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          /*  Bubbles */
          .bubble{
            fill: #fff;
            stroke: rgba(28, 163, 236, 0.5);
            stroke-width: 6;
            _opacity: 0.5;
            z-index: 100;
          }
          .bubble-flow-1{
            animation: bubble-flow-1 3s linear infinite;
          }
          .bubble-flow-2{
            animation: bubble-flow-2 2s linear infinite;
          }
          .bubble-flow-3{
            animation: bubble-flow-3 4s linear infinite;
          }
          @keyframes bubble-flow-1 {
            0% {
              transform: translate(-10px, 50px);
              opacity: 0;
            }
            25% {
              transform: translate(0px, 30px);
              opacity: 1;
            }
            50% {
              transform: translate(10px, -10px);
              opacity: 1;
            }
            75% {
              transform: translate(0px, -40px);
              opacity: 0.8;
            }
            100% {
              transform: translate(-10px, -80px);
              opacity: 0;
            }
          }
          @keyframes bubble-flow-2 {
            0% {
              transform: translate(-10px, 70px);
              opacity: 0;
            }
            25% {
              transform: translate(0px, 50px);
              opacity: 1;
            }
            50% {
              transform: translate(10px, 10px);
              opacity: 1;
            }
            75% {
              transform: translate(0px, -ยง0px);
              opacity: 0.8;
            }
            100% {
              transform: translate(-10px, -60px);
              opacity: 0;
            }
          }
          @keyframes bubble-flow-3 {
            0% {
              transform: translate(-10px, 30px);
              opacity: 0;
            }
            25% {
              transform: translate(0px, 10px);
              opacity: 1;
            }
            50% {
              transform: translate(10px, -30px);
              opacity: 1;
            }
            75% {
              transform: translate(0px, -60px);
              opacity: 0.8;
            }
            100% {
              transform: translate(-10px, -100px);
              opacity: 0;
            }
          }

          /*  Heat */
          .heat-wave {
            fill: none;
            stroke: #000;
            stroke-width: 17;
            stroke-linecap: round;
            opacity: 0.3;
            z-index: 100;
          }
          .heat-anim{
            animation: heat-gradient 2.5s linear infinite;
          }
          @keyframes heat-gradient {
            0% {
              opacity: 0;
              transform: scale(0.66) translateY(40px);
            }
            25% {
              opacity: 0.5;
              transform: scale(0.66) translateY(20px);
            }
            50% {
              opacity: 1;
              transform: scale(0.66) translateY(0px);
            }
            75% {
              opacity: 0.5;
              transform: scale(0.66) translateY(-20px);
            }
            100% {
              opacity: 0;
              transform: scale(0.66) translateY(-40px);
            }
          }
        </style>

        <div class="container">
          <svg class="machine-svg" viewBox="0 0 400 500">
            <g class="machine-group">
              <rect
                x="20"
                y="20"
                width="360"
                height="460"
                rx="30"
                fill="#fff"
                stroke="#000"
                stroke-width="4"
              />
              <circle
                cx="80"
                cy="80"
                r="25"
                fill="#000"
              />
              <circle
                cx="160"
                cy="80"
                r="25"
                fill="#000"
              />
              <circle
                cx="200"
                cy="300"
                r="120"
                fill="#fff"
                stroke="#000"
                stroke-width="50"
              />
            </g>

            <g class="bubble-group hidden">
              <circle class="bubble bubble-1"
                cx="170"
                cy="310"
                r="7"
              />
              <circle class="bubble bubble-2"
                cx="200"
                cy="280"
                r="7"
              />
              <circle class="bubble bubble-3"
                cx="230"
                cy="330"
                r="7"
              />
            </g>

            <g transform="translate(130 235)">
              <g class="heat-group hidden" transform="scale(0.66)">
                <path class="heat-wave"
                      d="M 60 160
                         C 80 140, 80 120, 60 100
                         C 40 80, 40 60, 60 40"
                />
                <path class="heat-wave"
                      d="M 100 160
                         C 120 140, 120 120, 100 100
                         C 80 80, 80 60, 100 40"
                />
                <path class="heat-wave"
                      d="M 140 160
                         C 160 140, 160 120, 140 100
                         C 120 80, 120 60, 140 40"
                />
              </g>
            </g>

            <g transform="translate(0 50)">
              <g class="swirl-group hidden">
                <circle class="arc outer left"
                  cx="200"
                  cy="250"
                  r="83"
                />
                <circle class="arc outer right"
                  cx="200"
                  cy="250"
                  r="83"
                />
                <circle class="arc inner left"
                  cx="200"
                  cy="250"
                  r="60"
                />
                <circle class="arc inner right"
                  cx="200"
                  cy="250"
                  r="60"
                />
              </g>
            </g>

            <text class="remaining-time"
                  x="210"
                  y="95">
              --:--
            </text>
            <text class="job-state-text"
                  x="195"
                  y="135">
            </text>

          </svg>

        </div>
      </ha-card>
    `;

    //Save the reference to the selector so that it can be called later
    this._jobText = this.querySelector(".job-state-text");
    this._timerText = this.querySelector(".remaining-time");

    this._swirlGroup = this.querySelector(".swirl-group");

    this._bubbleGroup = this.querySelector(".bubble-group");
    this._bubble1 = this.querySelector(".bubble-1");
    this._bubble2 = this.querySelector(".bubble-2");
    this._bubble3 = this.querySelector(".bubble-3");

    this._heatGroup = this.querySelector(".heat-group");
  }

  // The rules for sizing your card in the grid in sections view
  getGridOptions() {
    return {
      rows: 3,
      columns: 6,
      min_rows: 3,
      max_rows: 3,
    };
  }

  disconnectedCallback() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = undefined;
    }
  }
}

customElements.define(
  "washer-dryer-card",
  WasherDryerCard
);

window.customCards = window.customCards || [];

window.customCards.push({
  type: "washer-dryer-card",
  name: "Washer Dryer Card",
  description: "A custom card for washing machines and tumble dryers.",
});

console.info(`%c WASHER-DRYER-CARD %c v1.0.0`, "color: black; background: white; font-weight: 700;", "color: white; background: black; font-weight: 700;");
