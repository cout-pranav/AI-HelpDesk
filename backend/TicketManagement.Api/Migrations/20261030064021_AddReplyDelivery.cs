using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReplyDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DeliveryAttempts",
                table: "TicketMessages",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryError",
                table: "TicketMessages",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryStatus",
                table: "TicketMessages",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProviderMessageId",
                table: "TicketMessages",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SentAt",
                table: "TicketMessages",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TicketMessages_DeliveryStatus",
                table: "TicketMessages",
                column: "DeliveryStatus",
                filter: "[DeliveryStatus] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TicketMessages_DeliveryStatus",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "DeliveryAttempts",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "DeliveryError",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "DeliveryStatus",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "ProviderMessageId",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "SentAt",
                table: "TicketMessages");
        }
    }
}
