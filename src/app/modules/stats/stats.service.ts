/* eslint-disable @typescript-eslint/no-explicit-any */
import { Tour } from "../tour/tour.model";
import { IsActive } from "../user/user.interface";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { Payment } from "../payment/payment.model";
import { PAYMENT_STATUS } from "../payment/payment.interface";

const now = new Date();
const sevenDaysAgo = new Date(now).setDate(now.getDate() - 7);
const thirtyDaysAgo = new Date(now).setDate(now.getDate() - 30);

// * get user stats
const getUserStats = async () => {
  const totalUsersPromise = User.countDocuments();

  const totalActiveUsersPromise = User.countDocuments({
    isActive: IsActive.ACTIVE,
  });
  const totalInActiveUsersPromise = User.countDocuments({
    isActive: IsActive.INACTIVE,
  });
  const totalBlockedUsersPromise = User.countDocuments({
    isActive: IsActive.BLOCKED,
  });
  const newUsersInLast7DaysPromise = User.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });
  const newUsersInLast30DaysPromise = User.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });
  const getUserByRolePromise = User.aggregate([
    // stage-1 : Grouping user by role and count total user in each role
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);
  const [
    totalUsers,
    totalActiveUsers,
    totalInActiveUsers,
    totalBlockedUsers,
    newUsersInLast7Days,
    newUsersInLast30Days,
    getUserByRole,
  ] = await Promise.all([
    totalUsersPromise,
    totalActiveUsersPromise,
    totalInActiveUsersPromise,
    totalBlockedUsersPromise,
    newUsersInLast7DaysPromise,
    newUsersInLast30DaysPromise,
    getUserByRolePromise,
  ]);
  return {
    totalUsers,
    totalActiveUsers,
    totalInActiveUsers,
    totalBlockedUsers,
    newUsersInLast7Days,
    newUsersInLast30Days,
    getUserByRole,
  };
};

// * get tour stats
const getTourStats = async () => {
  const totalTourPromise = Tour.countDocuments();
  const totalTourByTourTypePromise = Tour.aggregate([
    // stage-1: connect Tour Type model - lookup stage
    {
      $lookup: {
        from: "tourtypes",
        localField: "tourType",
        foreignField: "_id",
        as: "type",
      },
    },
    // stage-2: unwind array to object
    {
      $unwind: "$type",
    },
    // stage-3: grouping tour type
    {
      $group: {
        _id: "$type.name",
        count: { $sum: 1 },
      },
    },
  ]);
  const avgTourCostPromise = Tour.aggregate([
    {
      $group: {
        _id: null,
        avgCostFrom: { $avg: "$costFrom" },
      },
    },
  ]);
  const totalTourByDivisionPromise = Tour.aggregate([
    // stage-1: connect Tour Division model - lookup stage
    {
      $lookup: {
        from: "divisions",
        localField: "division",
        foreignField: "_id",
        as: "division",
      },
    },
    // stage-2: unwind array to object
    {
      $unwind: "$division",
    },
    // stage-3: grouping tour type
    {
      $group: {
        _id: "$division.name",
        count: { $sum: 1 },
      },
    },
  ]);
  const totalHighestBookedTourPromise = Booking.aggregate([
    // stage-1: group the tour
    {
      $group: {
        _id: "$tour",
        bookingCount: { $sum: 1 },
      },
    },
    // stage-2: sort the tour
    {
      $sort: { bookingCount: -1 },
    },
    // stage-3: sort
    {
      $limit: 5,
    },
    // stage-4: lookup stage
    {
      $lookup: {
        from: "tours",
        let: { tourId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$tourId"] },
            },
          },
        ],
        as: "tour",
      },
    },
    // stage-5: unwind tour
    {
      $unwind: "$tour",
    },
    // stage-6: project field
    {
      $project: {
        bookingCount: 1,
        "tour.title": 1,
        "tour.slug": 1,
      },
    },
  ]);
  const [
    totalTour,
    totalTourByTourType,
    avgTourCost,
    totalTourByDivision,
    totalHighestBookedTour,
  ] = await Promise.all([
    totalTourPromise,
    totalTourByTourTypePromise,
    avgTourCostPromise,
    totalTourByDivisionPromise,
    totalHighestBookedTourPromise,
  ]);
  return {
    totalTour,
    totalTourByTourType,
    avgTourCost,
    totalTourByDivision,
    totalHighestBookedTour,
  };
};

// * get booking stats
const getBookingStats = async () => {
  const totalBookingPromise = Booking.countDocuments();
  const totalBookingByStatusPromise = Booking.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
  const bookingsPerTourPromise = Booking.aggregate([
    // stage-1: grouping tour
    {
      $group: {
        _id: "$tour",
        bookingCount: { $sum: 1 },
      },
    },
    // stage-2: sort stage
    {
      $sort: { bookingCount: -1 },
    },
    // stage-3: limit stage
    {
      $limit: 10,
    },
    // stage-4: lookup stage
    {
      $lookup: {
        from: "tours",
        localField: "_id",
        foreignField: "_id",
        as: "tour",
      },
    },
    // stage-5: unwind tour to object
    {
      $unwind: "$tour",
    },
    // stage-5: project stage
    {
      $project: {
        bookingCount: 1,
        _id: 1,
        "tour.title": 1,
        "tour.slug": 1,
      },
    },
  ]);
  const avgGuestCountPerBookingPromise = Booking.aggregate([
    {
      $group: {
        _id: null,
        avgGuestCount: { $avg: "$guestCount" },
      },
    },
  ]);
  const bookingsLast7DaysPromise = Booking.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });
  const bookingsLast30DaysPromise = Booking.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });
  const totalBookingByUniqueUsersPromise = Booking.distinct("user").then(
    (user: any) => user.length
  );
  const [
    totalBooking,
    totalBookingByStatus,
    bookingsPerTour,
    avgGuestCountPerBooking,
    bookingsLast7Days,
    bookingsLast30Days,
    totalBookingByUniqueUsers,
  ] = await Promise.all([
    totalBookingPromise,
    totalBookingByStatusPromise,
    bookingsPerTourPromise,
    avgGuestCountPerBookingPromise,
    bookingsLast7DaysPromise,
    bookingsLast30DaysPromise,
    totalBookingByUniqueUsersPromise,
  ]);
  return {
    totalBooking,
    totalBookingByStatus,
    bookingsPerTour,
    avgGuestCountPerBooking: avgGuestCountPerBooking[0].avgGuestCount,
    bookingsLast7Days,
    bookingsLast30Days,
    totalBookingByUniqueUsers,
  };
};

// * get payment stats
const getPaymentStats = async () => {
  const totalPaymentPromise = Payment.countDocuments();
  const totalPaymentByStatusPromise = Payment.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
  const totalRevenuePromise = Payment.aggregate([
    {
      // stage-1: match stage
      $match: { status: PAYMENT_STATUS.PAID },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
      },
    },
  ]);
  const avgPaymentAmountPromise = Payment.aggregate([
    //stage 1 group stage
    {
      $group: {
        _id: null,
        avgPaymentAMount: { $avg: "$amount" },
      },
    },
  ]);
  const paymentGatewayDataPromise = Payment.aggregate([
    // stage-1: grouping
    {
      $group: {
        _id: { $ifNull: ["$paymentGatewayData.status", "UNKNOWN"] },
        count: { $sum: 1 },
      },
    },
  ]);
  const [
    totalPayment,
    totalPaymentByStatus,
    totalRevenue,
    avgPaymentAmount,
    paymentGatewayData,
  ] = await Promise.all([
    totalPaymentPromise,
    totalPaymentByStatusPromise,
    totalRevenuePromise,
    avgPaymentAmountPromise,
    paymentGatewayDataPromise,
  ]);
  return {
    totalPayment,
    totalRevenue,
    totalPaymentByStatus,
    avgPaymentAmount,
    paymentGatewayData,
  };
};

/**
 * await Tour.updateMany(
        {
            // Only update where tourType or division is stored as a string
            $or: [
                { tourType: { $type: "string" } },
                { division: { $type: "string" } }
            ]
        },
        [
            {
                $set: {
                    tourType: { $toObjectId: "$tourType" },
                    division: { $toObjectId: "$division" }
                }
            }
        ]
    );
 */

export const StatsService = {
  getBookingStats,
  getPaymentStats,
  getTourStats,
  getUserStats,
};
