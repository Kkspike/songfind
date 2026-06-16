import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ListSummary } from '../api';

export default function ListsPage() {
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.getLists().then(setLists).catch((e) => setError(String(e)));
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createList(name.trim());
      setName('');
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDelete(id: string) {
    await api.deleteList(id);
    refresh();
  }

  return (
    <div>
      <h1>Lists</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleCreate}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New list name"
        />
        <button type="submit">Create list</button>
      </form>
      <ul>
        {lists.map((list) => (
          <li key={list.id}>
            <Link to={`/lists/${list.id}`}>{list.name}</Link> ({list.itemCount} tracks){' '}
            <button onClick={() => handleDelete(list.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
