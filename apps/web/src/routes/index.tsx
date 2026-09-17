import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type User, type Todo } from '../api';
export const Route = createFileRoute('/')({ component: App });
function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [register, setRegister] = useState(false),
    [todos, setTodos] = useState<Todo[]>([]),
    [filter, setFilter] = useState('all'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Todo | null>(null);
  async function load() {
    setTodos((await api.request<{ todos: Todo[] }>('/todos')).todos);
  }
  useEffect(() => {
    api
      .request<{ user: User }>('/auth/me')
      .then(async (r) => {
        setUser(r.user);
        await load();
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(e.message);
      })
      .finally(() => setReady(true));
  }, []);
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      if (e instanceof ApiError && e.status === 401) setUser(null);
    } finally {
      setBusy(false);
    }
  }
  async function auth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await perform(async () => {
      const result = await api.request<{ user: User }>(
        `/auth/${register ? 'register' : 'login'}`,
        { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) },
      );
      setUser(result.user);
      await load();
    });
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = Object.fromEntries(new FormData(form));
    await perform(async () => {
      await api.request(editing ? `/todos/${editing.id}` : '/todos', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(data),
      });
      setEditing(null);
      form.reset();
      await load();
    });
  }
  const remaining = todos.filter((t) => !t.completed).length;
  return (
    <main>
      <header>
        <a className="brand" href="/">
          ◒ <span>daybook</span>
        </a>
        <span className="eyebrow">A LITTLE SPACE FOR YOUR DAY HEHE</span>
        {user && (
          <button
            className="quiet"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await api.request('/auth/logout', {
                  method: 'POST',
                  body: '{}',
                });
                setUser(null);
                setTodos([]);
              })
            }
          >
            Log out
          </button>
        )}
      </header>
      {!ready ? (
        <p role="status">Opening your daybook…</p>
      ) : !user ? (
        <section className="auth">
          <div>
            <span className="tag">LESS NOISE. MORE FOCUS.</span>
            <h1>
              Make room
              <br />
              for what matters.
            </h1>
            <p className="intro">
              A simple home for the things you want to do.
              <br />
              One small step at a time.
            </p>
            <div className="illustration" aria-hidden="true">
              <span>✓</span>
              <div>
                A fresh start.
                <br />
                <small>Every single day.</small>
              </div>
            </div>
          </div>
          <form onSubmit={auth} className="card">
            <span className="tag">YOUR PERSONAL DAYBOOK</span>
            <h2>{register ? 'Create your account' : 'Welcome back'}</h2>
            <p>
              {register
                ? 'Start with a little intention.'
                : 'Pick up where you left off.'}
            </p>
            <label>
              Username
              <input
                name="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_]+"
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={15}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
              />
            </label>
            <small>
              Use 15–128 characters. A memorable passphrase works well.
            </small>
            <button className="primary" disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}
            </button>
            <button
              className="quiet"
              type="button"
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register
                ? 'Already have an account? Log in'
                : 'New here? Create an account'}
            </button>
          </form>
        </section>
      ) : (
        <section className="workspace">
          <div className="heading">
            <span className="tag">YOUR DAY, AT YOUR PACE</span>
            <h1>A little progress.</h1>
            <p>
              Hello, {user.username}. You have {remaining}{' '}
              {remaining === 1 ? 'thing' : 'things'} left to do.
            </p>
          </div>
          <div className="columns">
            <section className="list">
              <nav aria-label="Filter todos">
                {['all', 'active', 'completed'].map((f) => (
                  <button
                    key={f}
                    className={filter === f ? 'selected' : ''}
                    onClick={() => setFilter(f)}
                  >
                    {f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <span>{todos.length} total</span>
              </nav>
              {todos
                .filter(
                  (t) =>
                    filter === 'all' ||
                    (filter === 'completed' ? t.completed : !t.completed),
                )
                .map((t) => (
                  <article className="todo" key={t.id}>
                    <input
                      aria-label={`Complete ${t.title}`}
                      type="checkbox"
                      checked={t.completed}
                      disabled={busy}
                      onChange={() =>
                        void perform(async () => {
                          const previous = todos;
                          setTodos((items) =>
                            items.map((item) =>
                              item.id === t.id
                                ? { ...item, completed: !t.completed }
                                : item,
                            ),
                          );
                          try {
                            await api.request(`/todos/${t.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ completed: !t.completed }),
                            });
                            await load();
                          } catch (error) {
                            setTodos(previous);
                            throw error;
                          }
                        })
                      }
                    />
                    <div>
                      <h3 className={t.completed ? 'done' : ''}>{t.title}</h3>
                      {t.description && <p>{t.description}</p>}
                    </div>
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() => setEditing(t)}
                    >
                      Edit<span className="sr-only"> {t.title}</span>
                    </button>
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete “${t.title}”?`))
                          void perform(async () => {
                            await api.request(`/todos/${t.id}`, {
                              method: 'DELETE',
                              body: '{}',
                            });
                            await load();
                          });
                      }}
                    >
                      Delete<span className="sr-only"> {t.title}</span>
                    </button>
                  </article>
                ))}
              {!todos.some(
                (t) =>
                  filter === 'all' ||
                  (filter === 'completed' ? t.completed : !t.completed),
              ) && (
                <div className="empty">
                  <span>☀</span>
                  <h2>A little breathing room.</h2>
                  <p>
                    {todos.length
                      ? 'Nothing in this view.'
                      : 'Add your first todo to get started.'}
                  </p>
                </div>
              )}
            </section>
            <form
              className="card composer"
              key={editing?.id ?? 'new'}
              onSubmit={save}
            >
              <span className="tag">ONE STEP AT A TIME</span>
              <h2>{editing ? 'Edit todo' : 'What’s next?'}</h2>
              <label>
                Title
                <input
                  name="title"
                  placeholder="Something worth doing"
                  required
                  maxLength={200}
                  defaultValue={editing?.title}
                />
              </label>
              <label>
                Description <small>(optional)</small>
                <textarea
                  name="description"
                  rows={4}
                  maxLength={2000}
                  placeholder="A few details, if you need them"
                  defaultValue={editing?.description}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Add todo'}
              </button>
              {editing && (
                <button
                  type="button"
                  className="quiet"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        </section>
      )}
      {error && (
        <div role="alert" className="error">
          {error}
          <button className="quiet" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      <footer>
        Small steps add up. <span>MAKE TODAY YOURS.</span>
      </footer>
    </main>
  );
}
