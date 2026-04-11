package api

import (
	"sync"

	"github.com/Arnab-Afk/hackx/backend/internal/agent"
)

// eventBus fans out agent events to all WebSocket subscribers for a session.
type eventBus struct {
	mu   sync.RWMutex
	subs map[string][]chan agent.Event
}

var sessionBus = &eventBus{subs: make(map[string][]chan agent.Event)}

func (b *eventBus) subscribe(sessionID string) chan agent.Event {
	ch := make(chan agent.Event, 64)
	b.mu.Lock()
	b.subs[sessionID] = append(b.subs[sessionID], ch)
	b.mu.Unlock()
	return ch
}

func (b *eventBus) unsubscribe(sessionID string, ch chan agent.Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	subs := b.subs[sessionID]
	for i, s := range subs {
		if s == ch {
			b.subs[sessionID] = append(subs[:i], subs[i+1:]...)
			break
		}
	}
	if len(b.subs[sessionID]) == 0 {
		delete(b.subs, sessionID)
	}
}

func (b *eventBus) publish(sessionID string, event agent.Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.subs[sessionID] {
		select {
		case ch <- event:
		default:
		}
	}
}
