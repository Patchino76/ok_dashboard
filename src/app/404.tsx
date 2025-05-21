export default function Custom404() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>404 - Страницата не е намерена</h1>
      <p>Съжаляваме, не можем да намерим търсената от вас страница.</p>
      <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
        Към начална страница
      </a>
    </div>
  );
}
