const { Plugin, Modal, Notice, Setting, MarkdownView } = require("obsidian");

class Snippet {
  constructor(name, content, type, language = null) {
    this.name = name;
    this.content = content;
    this.type = type; // 'text', 'code'
    this.language = language;
  }
}

class SnippetModal extends Modal {
  constructor(app, onSubmit, snippet = null) {
    super(app);
    this.onSubmit = onSubmit;
    this.snippet = snippet; // Snippet à modifier
  }

  onOpen() {
    const { contentEl } = this;
    const title = this.snippet ? "Edit a snippet" : "Create a new snippet";
    contentEl.createEl("h2", { text: title });

    let name = this.snippet ? this.snippet.name : "";
    let type = this.snippet ? this.snippet.type : "text";
    let content = this.snippet ? this.snippet.content : "";
    let language = this.snippet ? this.snippet.language : "";

    // Input pour le nom du snippet
    new Setting(contentEl).setName("Name of snippet").addText((text) =>
      text.setValue(name).onChange((value) => {
        name = value;
      })
    );

    // Dropdown pour sélectionner le type de snippet
    const typeSetting = new Setting(contentEl)
      .setName("Type of snippet")
      .addDropdown((dropdown) => {
        dropdown.addOption("text", "Text");
        dropdown.addOption("code", "Code");
        dropdown.setValue(type); // Définir la valeur par défaut
        dropdown.onChange((value) => {
          type = value;
          updateVisibility();
        });
      });

    // Input pour le contenu du snippet
    const contentSetting = new Setting(contentEl)
      .setName("Snippet content")
      .addTextArea((textarea) => {
        textarea.setValue(content).onChange((value) => {
          content = value;
        });
      });

    // Réglages pour les snippets de code (langage de programmation)
    const languageSetting = new Setting(contentEl)
      .setName("Code language")
      .addDropdown((dropdown) => {
        dropdown.addOption("javascript", "JavaScript");
        dropdown.addOption("python", "Python");
        dropdown.addOption("html", "HTML");
        dropdown.addOption("css", "CSS");
        dropdown.addOption("markdown", "Markdown");
        dropdown.setValue(language); // Définir la valeur par défaut
        dropdown.onChange((value) => {
          language = value;
        });
      });

    // Bouton de création ou de modification du snippet
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.snippet ? "Edit Snippet" : "Create Snippet")
        .setCta()
        .onClick(() => {
          if (
            name.trim() === "" ||
            (type === "text" && content.trim() === "")
          ) {
            new Notice("Please fill in all required fields!");
            return;
          }

          const modifiedSnippet = new Snippet(name, content, type, language);
          this.onSubmit(modifiedSnippet, this.snippet);
          this.close(); // Fermer la modal après la soumission
        })
    );

    // Fonction pour gérer la visibilité des inputs
    const updateVisibility = () => {
      contentSetting.settingEl.style.display =
        type === "text" || type === "code" ? "block" : "none";
      languageSetting.settingEl.style.display =
        type === "code" ? "block" : "none";
    };

    // Mettre à jour la visibilité initiale
    updateVisibility();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SnippetManagerModal extends Modal {
  constructor(app, snippets, onSave, pluginInstance) {
    super(app);
    this.snippets = snippets;
    this.onSave = onSave;
    this.pluginInstance = pluginInstance;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Snippet management" });

    contentEl.style.display = "flex";
    contentEl.style.flexDirection = "column";

    this.renderSnippets();
  }

  renderSnippets() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Snippet management" });

    ["text", "code"].forEach((category) => {
      contentEl.createEl("h3", { text: `Snippets - ${category}` });
      this.snippets
        .filter((snippet) => snippet.type === category)
        .forEach((snippet) => {
          const setting = new Setting(contentEl)
            .setName(snippet.name)
            .setDesc(
              snippet.type === "code"
                ? `\`\`\`${snippet.language}\n${snippet.content}\n\`\`\``
                : snippet.content
            )
            .addButton((btn) =>
              btn.setButtonText("Insert").onClick(() => {
                this.insertSnippet(snippet);
                this.close();
              })
            )
            .addButton((btn) =>
              btn.setButtonText("Edit").onClick(() => {
                new SnippetModal(
                  this.app,
                  (modifiedSnippet) => {
                    const index = this.snippets.indexOf(snippet);
                    if (index > -1) {
                      this.snippets[index] = modifiedSnippet; // Remplacer le snippet
                      this.onSave(this.snippets); // Appel de onSave pour mettre à jour l'affichage
                      this.renderSnippets(); // Mettre à jour l'affichage instantanément
                    }
                  },
                  snippet
                ).open(); // Ouvrir la modal avec le snippet à modifier
              })
            )
            .addButton((btn) =>
              btn.setButtonText("Delete").onClick(() => {
                const index = this.snippets.indexOf(snippet);
                if (index > -1) {
                  this.snippets.splice(index, 1);
                  this.onSave(this.snippets); // Appel de onSave pour mettre à jour l'affichage
                  this.renderSnippets(); // Mettre à jour l'affichage instantanément
                }
              })
            );
        });
    });
  }

  insertSnippet(snippet) {
    const editor = this.app.workspace.getActiveViewOfType(MarkdownView).editor;
    const formattedSnippet = this.pluginInstance.formatSnippet(snippet);
    editor.replaceRange(formattedSnippet, editor.getCursor());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

module.exports = class ObsnippetsPlugin extends Plugin {
  async onload() {
    let loadedSnippets = await this.loadSnippets();
    this.snippets = Array.isArray(loadedSnippets) ? loadedSnippets : [];
    console.log("Loaded snippets:", this.snippets);

    // Commande pour ouvrir la modale de création de snippet
    this.addCommand({
      id: "open-snippet-modal",
      name: "Create a snippet",
      callback: () => {
        new SnippetModal(this.app, (snippet) => {
          if (snippet) {
            this.snippets.push(snippet);
            this.saveSnippets();
            new Notice(`Snippet "${snippet.name}" created !`);
          }
        }).open();
      },
    });

    // Commande pour ouvrir la gestion des snippets
    this.addCommand({
      id: "manage-snippets",
      name: "Insert in note and Manage snippets",
      callback: () => {
        new SnippetManagerModal(
          this.app,
          this.snippets,
          (updatedSnippets) => {
            if (updatedSnippets !== null) {
              this.saveSnippets();
            }
          },
          this
        ).open();
      },
    });
  }

  // Méthode pour sauvegarder les snippets
  async saveSnippets() {
    await this.saveData(this.snippets);
  }

  // Méthode pour charger les snippets
  async loadSnippets() {
    return await this.loadData();
  }

  // Formatage du snippet avant insertion
  formatSnippet(snippet) {
    if (snippet.type === "code") {
      return `\`\`\`${snippet.language}\n${snippet.content}\n\`\`\``;
    } else {
      return snippet.content;
    }
  }
};
