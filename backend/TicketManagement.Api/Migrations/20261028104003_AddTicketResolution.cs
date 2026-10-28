using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTicketResolution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ResolvedAt",
                table: "Tickets",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ResolvedByAi",
                table: "Tickets",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Existing resolved and closed tickets: their last update is the best available guess at
            // when they were resolved. Earlier AI resolutions can't be told apart from agent ones, so
            // ResolvedByAi stays false for them.
            migrationBuilder.Sql(
                "UPDATE Tickets SET ResolvedAt = UpdatedAt WHERE Status IN ('Resolved', 'Closed');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "ResolvedByAi",
                table: "Tickets");
        }
    }
}
