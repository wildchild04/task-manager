## ADDED Requirements

### Requirement: Mention labels
A mention MAY carry its own label. In the editor a mention SHALL show its label when it has one, and otherwise the target's current title (which continues to follow renames); a mention of a page that no longer exists SHALL still show the missing-page marker. A mention SHALL offer "Edit label" and "Reset to title": "Edit label" SHALL set the mention's label to text the human types (prefilled with the text currently shown), and an empty label SHALL be the same as "Reset to title", which SHALL clear the label so the mention follows the target's title again. Setting or clearing a label SHALL be one undo step, SHALL keep the mention one character, and SHALL NOT place the caret inside the mention. A labelled mention SHALL wrap like the text around it, as an unlabelled one does.

#### Scenario: Give a mention a short label
- **WHEN** a mention showing a task's 110-character title is given the label "Short-form mentions" with Edit label
- **THEN** the mention shows "Short-form mentions", one Cmd/Ctrl+Z restores the full title, and the mention still opens the task when clicked

#### Scenario: Reset a label to the title
- **WHEN** a labelled mention is reset to its title and the target page is then renamed
- **THEN** the mention shows the new title, with no label of its own

#### Scenario: Empty label clears it
- **WHEN** a labelled mention's label is edited to empty text
- **THEN** the mention shows the target's current title again, as if reset
