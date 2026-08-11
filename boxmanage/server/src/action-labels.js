const ACTION_LABELS = {
  created: 'Vytvořena',
  updated: 'Upravena',
  deleted: 'Smazána',
  moved: 'Přesunuta',
  position_changed: 'Změna pozice',
  item_added: 'Přidána položka',
  item_updated: 'Upravena položka',
  item_deleted: 'Smazána položka',
  quantity_added: 'Přidáno',
  quantity_removed: 'Vydáno',
  scanned: 'Naskenováno',
};

function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

module.exports = { ACTION_LABELS, actionLabel };
