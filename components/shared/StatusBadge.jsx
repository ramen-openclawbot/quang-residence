"use client";

import { STATUS_COLORS } from "../../lib/tokens";

const LABELS = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  in_progress: "Đang xử lý",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
  scheduled: "Đã lên lịch",
  waiting: "Đang chờ",
  tracking: "Theo dõi",
  registered: "Đã đăng ký",
  bidding: "Đang đấu",
  won: "Đã thắng",
  lost: "Thua",
  paid: "Đã thanh toán",
  shipping: "Đang vận chuyển",
  received: "Đã nhận",
  reported: "Đã báo",
  active: "Đang hoạt động",
  matured: "Đáo hạn",
  closed: "Đã tất toán",
};

export default function StatusBadge({ status, style = {} }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4,
      backgroundColor: colors.bg, color: colors.color,
      whiteSpace: "nowrap",
      ...style,
    }}>
      {LABELS[status] || status}
    </span>
  );
}
