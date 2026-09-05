import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog, Drawer } from './overlay';

describe('overlay body scroll locking', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('restores scrolling after nested overlays close together', () => {
    const onClose = () => undefined;
    const { rerender } = render(
      <>
        <Drawer open title="Policy" onClose={onClose}>
          Policy form
        </Drawer>
        <Drawer open title="Party" onClose={onClose}>
          Party form
        </Drawer>
      </>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Drawer open={false} title="Policy" onClose={onClose}>
          Policy form
        </Drawer>
        <Drawer open={false} title="Party" onClose={onClose}>
          Party form
        </Drawer>
      </>,
    );

    expect(document.body.style.overflow).toBe('');
  });

  it('keeps scrolling locked until the final overlay closes', () => {
    const onClose = () => undefined;
    const { rerender } = render(
      <>
        <Drawer open title="Policy" onClose={onClose}>
          Policy form
        </Drawer>
        <Drawer open title="Party" onClose={onClose}>
          Party form
        </Drawer>
      </>,
    );

    rerender(
      <>
        <Drawer open title="Policy" onClose={onClose}>
          Policy form
        </Drawer>
        <Drawer open={false} title="Party" onClose={onClose}>
          Party form
        </Drawer>
      </>,
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('keeps focus in a confirmation reason field while its value changes', () => {
    render(
      <ConfirmDialog
        open
        title="Cancel payable"
        message="Provide a reason."
        requireReason
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const reason = screen.getByLabelText(/Reason/);
    reason.focus();

    fireEvent.change(reason, { target: { value: 'T' } });
    expect(reason).toHaveFocus();
    fireEvent.change(reason, { target: { value: 'Th' } });
    expect(reason).toHaveFocus();
  });
});
