import { PlaylistView } from '@/components/PlaylistView';

export default function PlaylistPage({ params }: { params: { id: string } }) {
  return <PlaylistView playlistId={params.id} />;
}
