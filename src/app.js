import { SAMPLES } from "./samples.js";

const { QWeb, Component } = owl.core;

const MODES = {
  js: "ace/mode/javascript",
  css: "ace/mode/css",
  xml: "ace/mode/xml"
};

const DEFAULT_XML = `<templates>
</templates>`;

const TEMPLATE = `
  <div class="playground">
      <div class="left-bar" t-att-style="leftPaneStyle">
        <div class="menubar">
          <a class="tab" t-att-class="{active: state.currentTab==='js'}" t-on-click="setTab('js')">JS</a>
          <a class="tab" t-att-class="{active: state.currentTab==='xml'}" t-on-click="setTab('xml')">XML</a>
          <a class="tab" t-att-class="{active: state.currentTab==='css'}" t-on-click="setTab('css')">CSS</a>
          <div class="right-thing">
            <select t-on-change="setSample">
              <option t-foreach="SAMPLES" t-as="sample">
                <t t-esc="sample.description"/>
              </option>
            </select>
            <a class="btn run-code" t-on-click="runCode">▶ Run</a>
          </div>
        </div>
        <div class="code-editor" t-ref="editor"></div>
      </div>
      <div class="separator horizontal" t-on-mousedown="onMouseDown"/>
      <div class="right-pane"  t-att-style="rightPaneStyle">
        <div class="welcome" t-if="state.displayWelcome">
          <div>🦉 Odoo Web Lab 🦉</div>
          <div>v<t t-esc="version"/></div>
          <div class="url"><a href="https://github.com/odoo/owl">https://github.com/odoo/owl</a></div>
          <div class="note">Note: these examples require a recent browser to work without a transpilation step. </div>
        </div>
        <div t-if="state.error" class="error">
          <t t-esc="state.error.message"/>
        </div>
        <div class="content" t-ref="content"/>
      </div>
  </div>`;

class App extends Component {
  constructor(...args) {
    super(...args);
    this.version = owl._version;
    this.SAMPLES = SAMPLES;
    this.inlineTemplate = TEMPLATE;
    this.state = {
      currentTab: "js",
      js: SAMPLES[0].code,
      css: SAMPLES[0].css || "",
      xml: SAMPLES[0].xml || DEFAULT_XML,
      error: false,
      displayWelcome: true,
      leftPaneWidth: window.innerWidth / 2
    };
  }

  mounted() {
    this.editor = ace.edit(this.refs.editor);
    this.editor.session.setOption("useWorker", false);
    this.editor.setValue(this.state.js, -1);
    this.editor.setFontSize("14px");
    this.editor.setTheme("ace/theme/monokai");
    this.editor.session.setMode("ace/mode/javascript");
  }

  async runCode() {
    this.updateStateFromEditor();

    // check templates
    var qweb = new owl.core.QWeb();
    var error = false;
    try {
      qweb.loadTemplates(this.state.xml);
    } catch (e) {
      error = e;
    }

    await this.updateState({ error, displayWelcome: false });
    if (error) {
      this.refs.content.innerHTML = "";
      return;
    }

    // create iframe
    const iframe = document.createElement("iframe");

    iframe.onload = () => {
      const doc = iframe.contentWindow.document;
      // inject js
      const owlScript = doc.createElement("script");
      owlScript.type = "text/javascript";
      owlScript.src = "libs/owl.js";
      owlScript.addEventListener("load", () => {
        const script = doc.createElement("script");
        script.type = "text/javascript";
        const content = `window.TEMPLATES = \`${this.state.xml}\`\n${
          this.state.js
        }`;
        script.innerHTML = content;
        doc.body.appendChild(script);
      });
      doc.head.appendChild(owlScript);

      // inject css
      const style = document.createElement("style");
      style.innerHTML = this.state.css;
      doc.head.appendChild(style);
    };
    this.refs.content.innerHTML = "";
    this.refs.content.appendChild(iframe);
  }

  setSample(ev) {
    const sample = SAMPLES.find(s => s.description === ev.target.value);
    this.updateState({
      js: sample.code,
      css: sample.css || "",
      xml: sample.xml || DEFAULT_XML
    });
    this.editor.setValue(this.state[this.state.currentTab], -1);
  }

  updateStateFromEditor() {
    const value = this.editor.getValue();
    this.updateState({
      [this.state.currentTab]: value
    });
  }

  setTab(tab) {
    this.updateStateFromEditor();
    this.editor.setValue(this.state[tab], -1);

    const mode = MODES[tab];
    this.editor.session.setMode(mode);
    this.updateState({ currentTab: tab });
  }

  get leftPaneStyle() {
    return `width:${this.state.leftPaneWidth}px`;
  }

  get rightPaneStyle() {
    return `width:${window.innerWidth - 5 - this.state.leftPaneWidth}px`;
  }

  onMouseDown(ev) {
    const resizer = ev => {
      this.updateState({ leftPaneWidth: ev.clientX });
    };

    document.body.addEventListener("mousemove", resizer);
    for (let iframe of document.getElementsByTagName("iframe")) {
      iframe.classList.add("disabled");
    }

    document.body.addEventListener("mouseup", () => {
      document.body.removeEventListener("mousemove", resizer);
      for (let iframe of document.getElementsByTagName("iframe")) {
        iframe.classList.remove("disabled");
      }
    });
  }
}

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
document.title = `${document.title} (v${owl._version})`;
document.addEventListener("DOMContentLoaded", async function() {
  const qweb = new QWeb();
  const env = { qweb };
  const app = new App(env);
  app.mount(document.body);
});
