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

// sessionRegistry maps session IDs to live agent sessions so confirm signals can be delivered.
type sessionRegistryT struct {
	mu       sync.RWMutex
	sessions map[string]*agent.Session
}

var sessionRegistry = &sessionRegistryT{sessions: make(map[string]*agent.Session)}

func (r *sessionRegistryT) register(id string, s *agent.Session) {
	r.mu.Lock()
	r.sessions[id] = s
	r.mu.Unlock()
}

func (r *sessionRegistryT) deregister(id string) {
	r.mu.Lock()
	delete(r.sessions, id)
	r.mu.Unlock()
}

func (r *sessionRegistryT) get(id string) (*agent.Session, bool) {
	r.mu.RLock()
	s, ok := r.sessions[id]
	r.mu.RUnlock()
	return s, ok
}

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
