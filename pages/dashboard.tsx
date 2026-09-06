export function getServerSideProps() {
  return { redirect: { destination: "/portal", permanent: false } };
}

export default function LegacyDashboardRedirect() {
  return null;
}
