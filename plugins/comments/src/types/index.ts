export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_email: string;
  content: string;
  status: 'approved' | 'pending' | 'spam' | 'deleted';
  created_at: Date;
  updated_at: Date;
}

export interface CreateCommentInput {
  post_id: string;
  user_id: string;
  author_name: string;
  author_email: string;
  content: string;
}

export interface UpdateCommentInput {
  content?: string;
  status?: 'approved' | 'pending' | 'spam' | 'deleted';
}

export interface CommentQueryOptions {
  post_id?: string;
  user_id?: string;
  status?: 'approved' | 'pending' | 'spam' | 'deleted';
  limit?: number;
  offset?: number;
}
