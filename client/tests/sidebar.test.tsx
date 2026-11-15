import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConversationItem } from '../src/components/sidebar/ConversationItem';
import { Sidebar } from '../src/components/sidebar/Sidebar';
import { ChatInput } from '../src/components/input/ChatInput';
import { Conversation } from '../src/types/api';

describe('Sidebar & Input Components', () => {
  describe('ConversationItem', () => {
    const mockConv: Conversation = {
      id: 'conv-101',
      title: 'Quantum Physics Exploration',
      createdAt: '2026-03-31T09:00:00Z',
      updatedAt: '2026-03-31T09:30:00Z',
      messageCount: 4,
    };

    it('renders conversation title and active styling', () => {
      const onSelect = vi.fn();
      const onDelete = vi.fn();

      render(
        <ConversationItem
          conversation={mockConv}
          isActive={true}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      );

      expect(screen.getByText('Quantum Physics Exploration')).toBeInTheDocument();
      const item = screen.getByTestId('conversation-item-conv-101');
      expect(item.className).toContain('bg-indigo-600/10');
    });

    it('calls onSelect when clicked', () => {
      const onSelect = vi.fn();
      const onDelete = vi.fn();

      render(
        <ConversationItem
          conversation={mockConv}
          isActive={false}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      );

      fireEvent.click(screen.getByText('Quantum Physics Exploration'));
      expect(onSelect).toHaveBeenCalledWith('conv-101');
    });

    it('requires confirmation before deleting', async () => {
      const onSelect = vi.fn();
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <ConversationItem
          conversation={mockConv}
          isActive={false}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      );

      const deleteBtn = screen.getByLabelText('Delete conversation');
      await act(async () => {
        fireEvent.click(deleteBtn);
      });

      // Now confirmation check button is visible
      const confirmBtn = screen.getByLabelText('Confirm Delete');
      expect(confirmBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(confirmBtn);
      });
      expect(onDelete).toHaveBeenCalledWith('conv-101');
    });
  });

  describe('Sidebar', () => {
    const mockConversations: Conversation[] = [
      {
        id: 'c-1',
        title: 'React 19 Server Components',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 2,
      },
      {
        id: 'c-2',
        title: 'PostgreSQL Vector Search',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 6,
      },
    ];

    it('renders brand header and conversation list', () => {
      render(
        <Sidebar
          conversations={mockConversations}
          activeId="c-1"
          isOpen={true}
          onClose={vi.fn()}
          onSelectConversation={vi.fn()}
          onNewChat={vi.fn()}
          onDeleteConversation={vi.fn()}
        />
      );

      expect(screen.getByText('MiniMi AI')).toBeInTheDocument();
      expect(screen.getByText('React 19 Server Components')).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL Vector Search')).toBeInTheDocument();
    });

    it('triggers onNewChat when New Chat button is clicked', () => {
      const onNewChat = vi.fn();
      render(
        <Sidebar
          conversations={mockConversations}
          activeId={null}
          isOpen={true}
          onClose={vi.fn()}
          onSelectConversation={vi.fn()}
          onNewChat={onNewChat}
          onDeleteConversation={vi.fn()}
        />
      );

      const newChatBtn = screen.getByText('New Chat');
      fireEvent.click(newChatBtn);
      expect(onNewChat).toHaveBeenCalled();
    });
  });

  describe('ChatInput', () => {
    it('handles typing and submission on enter key', async () => {
      const onSendMessage = vi.fn().mockResolvedValue(undefined);

      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByLabelText('Chat message input');
      fireEvent.change(textarea, { target: { value: 'Explain gravitational waves' } });

      expect(textarea).toHaveValue('Explain gravitational waves');

      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      await waitFor(() => {
        expect(onSendMessage).toHaveBeenCalledWith('Explain gravitational waves');
      });
    });

    it('does not send on shift+enter, allows newline', () => {
      const onSendMessage = vi.fn();

      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByLabelText('Chat message input');
      fireEvent.change(textarea, { target: { value: 'Line 1' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('disables input when disabled prop is true', () => {
      render(<ChatInput onSendMessage={vi.fn()} disabled={true} />);

      const textarea = screen.getByLabelText('Chat message input');
      expect(textarea).toBeDisabled();

      const sendBtn = screen.getByLabelText('Send message');
      expect(sendBtn).toBeDisabled();
    });
  });
});
