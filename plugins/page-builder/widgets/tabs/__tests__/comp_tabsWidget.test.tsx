import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabsWidget from '../component';
import type { WidgetInstance } from '../../../src/types';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: (html: string) => html },
  sanitize: (html: string) => html,
}));

jest.mock('uuid', () => ({
  v4: () => 'new-tab-id',
}));

const baseWidget: WidgetInstance = {
  id: 'tabs-widget',
  type: 'tabs',
  position: { x: 0, y: 0, width: 4, height: 2 },
  config: {
    tabs: [
      { id: 't1', title: 'Overview', content: '<p>Overview</p>' },
      { id: 't2', title: 'Details', content: '<p>Details</p>' },
    ],
    activeTabBackgroundColor: '#fff',
    inactiveTabBackgroundColor: '#eee',
    tabTextColor: '#111',
  },
};

describe('comp_tabsWidget', () => {
  it('switches active tab in view mode', async () => {
    render(<TabsWidget widget={baseWidget} editMode={false} />);

    const overviewTab = screen.getByRole('tab', { name: /Overview/i });
    const detailsTab = screen.getByRole('tab', { name: /Details/i });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(detailsTab);
    expect(detailsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Details');
  });

  it('emits config updates when adding tabs in edit mode', async () => {
    const onChange = jest.fn();
    render(<TabsWidget widget={baseWidget} editMode onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /\+ Add Tab/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: expect.arrayContaining([
          expect.objectContaining({ id: 'new-tab-id', title: 'Tab 3', content: '' }),
        ]),
      })
    );
  });
});
