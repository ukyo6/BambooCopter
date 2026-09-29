const { contextBridge, ipcRenderer } = require('electron');

function call(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld('lc', {
  agentState: () => call('agent:state'),
  selectAgent: (payload) => call('agent:select', payload),
  listProblems: () => call('problems:list'),
  refreshProblems: () => call('problems:refresh'),
  problemDetail: (slug) => call('problems:detail', { slug }),
  saveDraft: (slug, code) => call('draft:save', { slug, code }),
  listHistory: (slug) => call('history:list', { slug }),
  practiceBoard: () => call('records:board'),
  listChat: (slug) => call('chat:list', { slug }),
  sendChat: (payload) => call('chat:send', payload),
  submitReview: (payload) => call('review:submit', payload),
});
